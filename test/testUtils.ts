"use strict";

import {ModeName} from '../src/mode/mode';
import {Position} from '../src/motion/position';
import {TextEditor} from '../src/textEditor';
import * as vscode from "vscode";
import * as assert from 'assert';
import {join} from 'path';
import * as os from 'os';
import * as fs from 'fs';

function rndName() {
  return Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 10);
}

async function createRandomFile(contents: string): Promise<vscode.Uri> {
  const tmpFile = join(os.tmpdir(), rndName());

  try {
    fs.writeFileSync(tmpFile, contents);
    return vscode.Uri.file(tmpFile);
  } catch (error) {
    throw error;
  }
}

export function assertEqualLines(expectedLines: string[]) {
  assert.equal(TextEditor.getLineCount(), expectedLines.length, "Line count does not match.");

  for (let i = 0; i < expectedLines.length; i++) {
    assert.equal(TextEditor.readLineAt(i), expectedLines[i], `Line ${i} is different.`);
  }
}

export function assertEqualPosition(actual: Position, expected: Position, message = ''): void {
  assert.equal(actual.line, expected.line, "Cursor LINE position is wrong. " + message);
  assert.equal(actual.character, expected.character, "Cursor CHARACTER position is wrong. " + message);
}

export function assertEqualMode(actual: ModeName, expected?: ModeName, message = ''): void {
  if (typeof expected !== "undefined") {
    assert.equal(ModeName[actual].toUpperCase(), ModeName[expected].toUpperCase(), "Didn't enter correct mode. " + message);
  }
}

/**
 * Assert that the first two arguments are equal, and fail a test otherwise.
 *
 * The only difference between this and assert.equal is that here we
 * check to ensure the types of the variables are correct.
 */
export function assertEqual<T>(one: T, two: T, message: string = ""): void {
  assert.equal(one, two, message);
}

export async function setupWorkspace(): Promise<any> {
  const file   = await createRandomFile("");
  const doc  = await vscode.workspace.openTextDocument(file);

  await vscode.window.showTextDocument(doc);
  setTextEditorOptions(2, true);

  assert.ok(vscode.window.activeTextEditor);
}

export async function cleanUpWorkspace(): Promise<any> {
  // https://github.com/Microsoft/vscode/blob/master/extensions/vscode-api-tests/src/utils.ts
  return new Promise((c, e) => {
    if (vscode.window.visibleTextEditors.length === 0) {
      return c();
    }

    // TODO: the visibleTextEditors variable doesn't seem to be
    // up to date after a onDidChangeActiveTextEditor event, not
    // even using a setTimeout 0... so we MUST poll :(
    let interval = setInterval(() => {
      if (vscode.window.visibleTextEditors.length > 0) {
        return;
      }

      clearInterval(interval);
      c();
    }, 10);

    vscode.commands.executeCommand('workbench.action.closeAllEditors')
      .then(() => null, (err: any) => {
        clearInterval(interval);
        e(err);
      });
  }).then(() => {
    assert.equal(vscode.window.visibleTextEditors.length, 0);
    assert(!vscode.window.activeTextEditor);
  });
}

export function setTextEditorOptions(tabSize: number | string, insertSpaces: boolean | string): void {
  vscode.window.activeTextEditor.options = {
    tabSize,
    insertSpaces
  };
}