import * as assert from 'assert';
import { ModeName } from '../src/mode/mode';
import { Position } from '../src/motion/position';
import { ModeHandler } from '../src/mode/modeHandler';
import { TextEditor } from '../src/textEditor';
import { assertEqualLines, assertEqualPosition, assertEqualMode } from './testUtils';

export function getTestingFunctions(modeHandler: ModeHandler) {
  let testWithObject = testIt.bind(null, modeHandler);

  const newTest = (testObj: ITestObject): void => {
    const stack = (new Error()).stack;
    let niceStack = stack ? stack.split('\n').splice(2, 1).join('\n') : "no stack available :(";

    test(testObj.title, async () => testWithObject(testObj)
      .catch((reason: Error) => {
        reason.stack = niceStack;
        throw reason;
      })
    );
  };

  const newTestOnly = (testObj: ITestObject): void => {
    console.log("!!! Running single test !!!");

    const stack = (new Error()).stack;
    let niceStack = stack ? stack.split('\n').splice(2, 1).join('\n') : "no stack available :(";

    test.only(testObj.title, async () => testWithObject(testObj)
      .catch((reason: Error) => {
        reason.stack = niceStack;
        throw reason;
      })
    );
  };

  return {
    newTest,
    newTestOnly,
  };
}

interface ITestObject {
  title: string;
  start: string[];
  keysPressed: string;
  end: string[];
  endMode?: ModeName;
}

class TestObjectHelper {
  startPosition = new Position(0, 0);
  endPosition = new Position(0, 0);

  private _isValid = false;
  private _testObject: ITestObject;

  constructor(_testObject: ITestObject) {
    this._testObject = _testObject;

    this._parse(_testObject);
  }

  public get isValid(): boolean {
    return this._isValid;
  }

  private _setStartCursorPosition(lines: string[]): boolean {
    let result = this._getCursorPosition(lines);
    this.startPosition = result.position;
    return result.success;
  }

  private _setEndCursorPosition(lines: string[]): boolean {
    let result = this._getCursorPosition(lines);
    this.endPosition = result.position;
    return result.success;
  }

  private _getCursorPosition(lines: string[]): { success: boolean; position: Position} {
    let ret = { success: false, position: new Position(0, 0) };
    for (let i = 0; i < lines.length; i++) {
      let columnIdx = lines[i].indexOf('|');
      if (columnIdx >= 0) {
        ret.position = ret.position.setLocation(i, columnIdx);
        ret.success = true;
      }
    }

    return ret;
  }

  private _parse(t: ITestObject): void {
    if (!this._setStartCursorPosition(t.start)) {
      this._isValid = false;
      return;
    }
    if (!this._setEndCursorPosition(t.end)) {
      this._isValid = false;
      return;
    }

    this._isValid = true;
  }

  public asVimInputText(): string {
    return this._testObject.start.join('\n').replace('|', '');
  }

  public asVimOutputText(): string[] {
    let ret = this._testObject.end.slice(0);
    ret[this.endPosition.line] = ret[this.endPosition.line].replace('|', '');
    return ret;
  }

  /**
   * Returns a sequence of Vim movement characters '10G5|' as a string array
   * which will move the cursor to the start position given in the test.
   */
  public getKeyPressesToMoveToStartPosition(): string[] {
    let ret = '';

    // if there's only one line of start text, we're already on it
    if (this._testObject.start.length > 1) {
      ret += (this.startPosition.line + 1).toString() + 'G';
    }

    if (this.startPosition.character === 0) {
      ret += '0';
    } else {
      ret += (this.startPosition.character + 1).toString() + '|';
    }

    return ret.split('');
  }
}

/**
 * Tokenize a string like "abc<esc>d<c-c>" into ["a", "b", "c", "<esc>", "d", "<c-c>"]
 */
function tokenizeKeySequence(sequence: string): string[] {
  return sequence.match(/(<[^<>]*?>)|[\s\S]/g);
}

async function testIt(modeHandler: ModeHandler, testObj: ITestObject): Promise<void> {
  let helper = new TestObjectHelper(testObj);

  // Check valid test object input
  assert(helper.isValid, "Missing '|' in test object.");

  // set up starting text state. Then fix up vim state by setting cursor position & calling handleKeyEventHelper directly
  await TextEditor.insert(helper.asVimInputText(), new Position(0, 0), false);
  modeHandler.vimState.cursorPosition = Position.FromVSCodePosition(TextEditor.getSelection().start);
  (modeHandler as any)._vimState = await (modeHandler as any).handleKeyEventHelper('<esc>', modeHandler.vimState);

  // move cursor to start position
  await modeHandler.handleMultipleKeyEvents(helper.getKeyPressesToMoveToStartPosition());

  // validate cursor starts in correct position, and is in the right mode
  assertEqualPosition(Position.FromVSCodePosition(TextEditor.getSelection().start), helper.startPosition, "Before keysPressed.");
  assertEqualMode(modeHandler.currentMode.name, ModeName.Normal);

  // perform test actions
  await modeHandler.handleMultipleKeyEvents(tokenizeKeySequence(testObj.keysPressed));

  // check final cursor position, end text, and mode (if specified)
  assertEqualLines(helper.asVimOutputText());
  assertEqualPosition(Position.FromVSCodePosition(TextEditor.getSelection().start), helper.endPosition, "After keysPressed.");
  assertEqualMode(modeHandler.currentMode.name, testObj.endMode);
}

export { ITestObject, testIt }