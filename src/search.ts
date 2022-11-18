import { CancellationToken } from './cancellation'
import * as glob from './glob'
import { getNLines } from './strings'
import { isThenable, mapArrayOrNot } from './utils'

// Warning: this pattern is used in the search editor to detect offsets. If you
// change this, also change the search-result built-in extension
const SEARCH_ELIDED_PREFIX = '⟪ ';
const SEARCH_ELIDED_SUFFIX = ' characters skipped ⟫';
const SEARCH_ELIDED_MIN_LEN = (SEARCH_ELIDED_PREFIX.length + SEARCH_ELIDED_SUFFIX.length + 5) * 2;

export type ITextSearchResult = ITextSearchMatch | ITextSearchContext;

export interface IExtendedExtensionSearchOptions {
  usePCRE2?: boolean;
}

export interface ISerializedFileMatch {
  path: string;
  results?: ITextSearchResult[];
  numMatches?: number;
}

export interface ITextSearchResultPreview {
  text: string;
  matches: ISearchRange | ISearchRange[];
}

export interface ITextSearchMatch {
  path: string;
  ranges: ISearchRange | ISearchRange[];
  preview: ITextSearchResultPreview;
}

export interface ITextSearchContext {
  path: string;
  text: string;
  lineNumber: number;
}

export interface IFileMatch {
  path: string;
  results?: ITextSearchResult[];
}

export interface ISerializedFileMatch {
  path: string;
  results?: ITextSearchResult[];
  numMatches?: number;
}

export interface ICommonQueryProps {
  /** For telemetry - indicates what is triggering the source */
  _reason?: string;

  folderQueries: IFolderQuery[];
  includePattern?: glob.IExpression;
  excludePattern?: glob.IExpression;
  extraFilePaths?: string[];

  onlyOpenEditors?: boolean;

  maxResults?: number;
  usingSearchPaths?: boolean;
}

export interface ITextSearchPreviewOptions {
  matchLines: number;
  charsPerLine: number;
}

export interface ITextQuery extends ICommonQueryProps {
  contentPattern: IPatternInfo;

  previewOptions?: ITextSearchPreviewOptions;
  maxFileSize?: number;
  usePCRE2?: boolean;
  afterContext?: number;
  beforeContext?: number;

  userDisabledExcludesAndIgnoreFiles?: boolean;
}

export interface IProgressMessage {
  message: string;
}

export enum TextSearchCompleteMessageType {
  Information = 1,
  Warning = 2,
}

export interface ITextSearchCompleteMessage {
  text: string;
  type: TextSearchCompleteMessageType;
  trusted?: boolean;
}

export interface ISerializedSearchSuccess {
  limitHit: boolean;
  messages?: ITextSearchCompleteMessage[];
}

export type ProviderResult<T> = T | undefined | null | Thenable<T | undefined | null>;

export interface TextSearchProvider {
  provideTextSearchResults(query: TextSearchQuery, options: TextSearchOptions, progress: IProgress<ITextSearchResult>, token: CancellationToken): ProviderResult<ISerializedSearchSuccess>;
}

export class QueryGlobTester {

  private _excludeExpression: glob.IExpression;
  private _parsedExcludeExpression: glob.ParsedExpression;

  private _parsedIncludeExpression: glob.ParsedExpression | null = null;

  constructor(config: ITextQuery, folderQuery: IFolderQuery) {
    this._excludeExpression = {
      ...(config.excludePattern || {}),
      ...(folderQuery.excludePattern || {})
    };
    this._parsedExcludeExpression = glob.parse(this._excludeExpression);

    // Empty includeExpression means include nothing, so no {} shortcuts
    let includeExpression: glob.IExpression | undefined = config.includePattern;
    if (folderQuery.includePattern) {
      if (includeExpression) {
        includeExpression = {
          ...includeExpression,
          ...folderQuery.includePattern
        };
      } else {
        includeExpression = folderQuery.includePattern;
      }
    }

    if (includeExpression) {
      this._parsedIncludeExpression = glob.parse(includeExpression);
    }
  }

  matchesExcludesSync(testPath: string, basename?: string, hasSibling?: (name: string) => boolean): boolean {
    if (this._parsedExcludeExpression && this._parsedExcludeExpression(testPath, basename, hasSibling)) {
      return true;
    }

    return false;
  }

  /**
   * Guaranteed sync - siblingsFn should not return a promise.
   */
  includedInQuerySync(testPath: string, basename?: string, hasSibling?: (name: string) => boolean): boolean {
    if (this._parsedExcludeExpression && this._parsedExcludeExpression(testPath, basename, hasSibling)) {
      return false;
    }

    if (this._parsedIncludeExpression && !this._parsedIncludeExpression(testPath, basename, hasSibling)) {
      return false;
    }

    return true;
  }

  /**
   * Evaluating the exclude expression is only async if it includes sibling clauses. As an optimization, avoid doing anything with Promises
   * unless the expression is async.
   */
  includedInQuery(testPath: string, basename?: string, hasSibling?: (name: string) => boolean | Promise<boolean>): Promise<boolean> | boolean {
    const excluded = this._parsedExcludeExpression(testPath, basename, hasSibling);

    const isIncluded = () => {
      return this._parsedIncludeExpression ?
        !!(this._parsedIncludeExpression(testPath, basename, hasSibling)) :
        true;
    };

    if (isThenable(excluded)) {
      return excluded.then(excluded => {
        if (excluded) {
          return false;
        }

        return isIncluded();
      });
    }

    return isIncluded();
  }

  hasSiblingExcludeClauses(): boolean {
    return hasSiblingClauses(this._excludeExpression);
  }
}

function hasSiblingClauses(pattern: glob.IExpression): boolean {
  for (const key in pattern) {
    if (typeof pattern[key] !== 'boolean') {
      return true;
    }
  }

  return false;
}

export function hasSiblingPromiseFn(siblingsFn?: () => Promise<string[]>) {
  if (!siblingsFn) {
    return undefined;
  }

  let siblings: Promise<Record<string, true>>;
  return (name: string) => {
    if (!siblings) {
      siblings = (siblingsFn() || Promise.resolve([]))
        .then(list => list ? listToMap(list) : {});
    }
    return siblings.then(map => !!map[name]);
  };
}

function listToMap(list: string[]) {
  const map: Record<string, true> = {};
  for (const key of list) {
    map[key] = true;
  }
  return map;
}

export interface SearchOptions {
  /**
   * The root folder to search within.
   */
  folder: string;

  /**
   * Files that match an `includes` glob pattern should be included in the search.
   */
  includes: string[];

  /**
   * Files that match an `excludes` glob pattern should be excluded from the search.
   */
  excludes: string[];

  /**
   * Whether external files that exclude files, like .gitignore, should be respected.
   * See the vscode setting `"search.useIgnoreFiles"`.
   */
  useIgnoreFiles: boolean;

  /**
   * Whether symlinks should be followed while searching.
   * See the vscode setting `"search.followSymlinks"`.
   */
  followSymlinks: boolean;

  /**
   * Whether global files that exclude files, like .gitignore, should be respected.
   * See the vscode setting `"search.useGlobalIgnoreFiles"`.
   */
  useGlobalIgnoreFiles: boolean;

  /**
   * Whether files in parent directories that exclude files, like .gitignore, should be respected.
   * See the vscode setting `"search.useParentIgnoreFiles"`.
   */
  useParentIgnoreFiles: boolean;
}

export interface TextSearchOptions extends SearchOptions {
  /**
   * The maximum number of results to be returned.
   */
  maxResults: number;

  /**
   * Options to specify the size of the result text preview.
   */
  previewOptions?: TextSearchPreviewOptions;

  /**
   * Exclude files larger than `maxFileSize` in bytes.
   */
  maxFileSize?: number;

  /**
   * Interpret files using this encoding.
   * See the vscode setting `"files.encoding"`
   */
  encoding?: string;

  /**
   * Number of lines of context to include before each match.
   */
  beforeContext?: number;

  /**
   * Number of lines of context to include after each match.
   */
  afterContext?: number;
  usePCRE2?: boolean;
}

export interface IFolderQuery {
  folder: string;
  folderName?: string;
  excludePattern?: glob.IExpression;
  includePattern?: glob.IExpression;
  fileEncoding?: string;
  disregardIgnoreFiles?: boolean;
  disregardGlobalIgnoreFiles?: boolean;
  disregardParentIgnoreFiles?: boolean;
  ignoreSymlinks?: boolean;
}

export function resolvePatternsForProvider(globalPattern: glob.IExpression | undefined, folderPattern: glob.IExpression | undefined): string[] {
  const merged = {
    ...(globalPattern || {}),
    ...(folderPattern || {})
  };

  return Object.keys(merged)
    .filter(key => {
      const value = merged[key];
      return typeof value === 'boolean' && value;
    });
}

export interface IPatternInfo {
  pattern: string;
  isRegExp?: boolean;
  isWordMatch?: boolean;
  wordSeparators?: string;
  isMultiline?: boolean;
  isUnicode?: boolean;
  isCaseSensitive?: boolean;
}

export interface TextSearchQuery {
  /**
   * The text pattern to search for.
   */
  pattern: string;

  /**
   * Whether or not `pattern` should match multiple lines of text.
   */
  isMultiline?: boolean;

  /**
   * Whether or not `pattern` should be interpreted as a regular expression.
   */
  isRegExp?: boolean;

  /**
   * Whether or not the search should be case-sensitive.
   */
  isCaseSensitive?: boolean;

  /**
   * Whether or not to search for whole word matches only.
   */
  isWordMatch?: boolean;
}

export interface IProgress<T> {
  report(item: T): void;
}

export class Progress<T> implements IProgress<T> {

  static readonly None = Object.freeze<IProgress<unknown>>({ report() { } });

  private _value?: T;
  get value(): T | undefined { return this._value; }

  constructor(private callback: (data: T) => void) { }

  report(item: T) {
    this._value = item;
    this.callback(this._value);
  }
}

export enum SearchErrorCode {
  unknownEncoding = 1,
  regexParseError,
  globParseError,
  invalidLiteral,
  rgProcessError,
  other,
  canceled
}

export class SearchError extends Error {
  constructor(message: string, readonly code?: SearchErrorCode) {
    super(message);
  }
}

export function serializeSearchError(searchError: SearchError): Error {
  const details = { message: searchError.message, code: searchError.code };
  return new Error(JSON.stringify(details));
}

export interface TextSearchPreviewOptions {
  /**
   * The maximum number of lines in the preview.
   * Only search providers that support multiline search will ever return more than one line in the match.
   */
  matchLines: number;

  /**
   * The maximum number of characters included per line.
   */
  charsPerLine: number;
}

function isSingleLineRangeList(ranges: ISearchRange[]): boolean {
  const line = ranges[0].startLineNumber;
  for (const r of ranges) {
    if (r.startLineNumber !== line || r.endLineNumber !== line) {
      return false;
    }
  }

  return true;
}

export class SearchRange implements ISearchRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;

  constructor(startLineNumber: number, startColumn: number, endLineNumber: number, endColumn: number) {
    this.startLineNumber = startLineNumber;
    this.startColumn = startColumn;
    this.endLineNumber = endLineNumber;
    this.endColumn = endColumn;
  }
}

export class OneLineRange extends SearchRange {
  constructor(lineNumber: number, startColumn: number, endColumn: number) {
    super(lineNumber, startColumn, lineNumber, endColumn);
  }
}

export class TextSearchMatch implements ITextSearchMatch {
  ranges: ISearchRange | ISearchRange[];
  preview: ITextSearchResultPreview;
  path: string;

  constructor(text: string, range: ISearchRange | ISearchRange[], previewOptions?: ITextSearchPreviewOptions) {
    this.ranges = range;

    // Trim preview if this is one match and a single-line match with a preview requested.
    // Otherwise send the full text, like for replace or for showing multiple previews.
    // TODO this is fishy.
    const ranges = Array.isArray(range) ? range : [range];
    if (previewOptions && previewOptions.matchLines === 1 && isSingleLineRangeList(ranges)) {
      // 1 line preview requested
      text = getNLines(text, previewOptions.matchLines);

      let result = '';
      let shift = 0;
      let lastEnd = 0;
      const leadingChars = Math.floor(previewOptions.charsPerLine / 5);
      const matches: ISearchRange[] = [];
      for (const range of ranges) {
        const previewStart = Math.max(range.startColumn - leadingChars, 0);
        const previewEnd = range.startColumn + previewOptions.charsPerLine;
        if (previewStart > lastEnd + leadingChars + SEARCH_ELIDED_MIN_LEN) {
          const elision = SEARCH_ELIDED_PREFIX + (previewStart - lastEnd) + SEARCH_ELIDED_SUFFIX;
          result += elision + text.slice(previewStart, previewEnd);
          shift += previewStart - (lastEnd + elision.length);
        } else {
          result += text.slice(lastEnd, previewEnd);
        }

        matches.push(new OneLineRange(0, range.startColumn - shift, range.endColumn - shift));
        lastEnd = previewEnd;
      }

      this.preview = { text: result, matches: Array.isArray(this.ranges) ? matches : matches[0] };
    } else {
      const firstMatchLine = Array.isArray(range) ? range[0].startLineNumber : range.startLineNumber;

      this.preview = {
        text,
        matches: mapArrayOrNot(range, r => new SearchRange(r.startLineNumber - firstMatchLine, r.startColumn, r.endLineNumber - firstMatchLine, r.endColumn))
      };
    }
  }
}

/**
 * A line of context surrounding a TextSearchMatch.
 */
 export interface TextSearchContext {
  path: string;
  text: string;
  lineNumber: number;
}

export interface ISearchRange {
  readonly startLineNumber: number;
  readonly startColumn: number;
  readonly endLineNumber: number;
  readonly endColumn: number;
}

interface Thenable<T> {
  /**
  * Attaches callbacks for the resolution and/or rejection of the Promise.
  * @param onfulfilled The callback to execute when the Promise is resolved.
  * @param onrejected The callback to execute when the Promise is rejected.
  * @returns A Promise for the completion of which ever callback is executed.
  */
  then<TResult>(onfulfilled?: (value: T) => TResult | Thenable<TResult>, onrejected?: (reason: any) => TResult | Thenable<TResult>): Thenable<TResult>;
  then<TResult>(onfulfilled?: (value: T) => TResult | Thenable<TResult>, onrejected?: (reason: any) => void): Thenable<TResult>;
}
