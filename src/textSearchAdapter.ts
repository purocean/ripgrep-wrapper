/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { CancellationToken } from './cancellation';
import { IFileMatch, IProgressMessage, ISerializedFileMatch, ISerializedSearchSuccess, ITextQuery, ITextSearchMatch, TextSearchProvider } from './search';
import { TextSearchManager } from './textSearchManager'
import { RipgrepTextSearchEngine } from './ripgrepTextSearchEngine'

export function toCanonicalName(enc: string): string {
  switch (enc) {
    case 'shiftjis':
      return 'shift-jis';
    case 'utf16le':
      return 'utf-16le';
    case 'utf16be':
      return 'utf-16be';
    case 'big5hkscs':
      return 'big5-hkscs';
    case 'eucjp':
      return 'euc-jp';
    case 'euckr':
      return 'euc-kr';
    case 'koi8r':
      return 'koi8-r';
    case 'koi8u':
      return 'koi8-u';
    case 'macroman':
      return 'x-mac-roman';
    case 'utf8bom':
      return 'utf8';
    default: {
      const m = enc.match(/windows(\d+)/);
      if (m) {
        return 'windows-' + m[1];
      }

      return enc;
    }
  }
}

export class NativeTextSearchManager extends TextSearchManager {
  constructor(query: ITextQuery, provider: TextSearchProvider) {
    super(query, provider, {
      readdir: path => fs.promises.readdir(path),
      toCanonicalName: name => toCanonicalName(name)
    });
  }
}

export class TextSearchEngineAdapter {

  constructor(private query: ITextQuery) { }

  search(token: CancellationToken, onResult: (matches: ISerializedFileMatch[]) => void, onMessage: (message: IProgressMessage) => void): Promise<ISerializedSearchSuccess> {
    if ((!this.query.folderQueries || !this.query.folderQueries.length) && (!this.query.extraFilePaths || !this.query.extraFilePaths.length)) {
      return Promise.resolve(<ISerializedSearchSuccess>{
        limitHit: false,
      });
    }

    const pretendOutputChannel = {
      appendLine(msg: string) {
        onMessage({ message: msg });
      }
    };

    const textSearchManager = new NativeTextSearchManager(this.query, new RipgrepTextSearchEngine(pretendOutputChannel));
    return new Promise((resolve, reject) => {
      return textSearchManager
        .search(
          matches => {
            onResult(matches.map(fileMatchToSerialized));
          },
          token)
        .then(
          c => resolve({ limitHit: c.limitHit } as ISerializedSearchSuccess),
          reject);
    });
  }
}

function fileMatchToSerialized(match: IFileMatch): ISerializedFileMatch {
  return {
    path: match.path,
    results: match.results,
    numMatches: (match.results || []).reduce((sum, r) => {
      if (!!(<ITextSearchMatch>r).ranges) {
        const m = <ITextSearchMatch>r;
        return sum + (Array.isArray(m.ranges) ? m.ranges.length : 1);
      } else {
        return sum + 1;
      }
    }, 0)
  };
}
