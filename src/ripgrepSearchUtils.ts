/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ISearchRange, TextSearchMatch, TextSearchPreviewOptions } from './search'

export type Maybe<T> = T | null | undefined;

export function anchorGlob(glob: string): string {
  return glob.startsWith('**') || glob.startsWith('/') ? glob : `/${glob}`;
}

/**
 * Create a vscode.TextSearchMatch by using our internal TextSearchMatch type for its previewOptions logic.
 */
export function createTextSearchResult(path: string, text: string, ranges: ISearchRange | ISearchRange[], previewOptions?: TextSearchPreviewOptions): TextSearchMatch {
  const internalResult = new TextSearchMatch(text, ranges, previewOptions);
  const internalPreviewRange = internalResult.preview.matches;
  return {
    ranges,
    path,
    preview: {
      text: internalResult.preview.text,
      matches: internalPreviewRange
    }
  };
}

export interface IOutputChannel {
  appendLine(msg: string): void;
}

export class OutputChannel implements IOutputChannel {
  constructor(private prefix: string) { }

  appendLine(msg: string): void {
    console.debug(`${this.prefix}#search`, msg);
  }
}
