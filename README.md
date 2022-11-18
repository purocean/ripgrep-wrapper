# ripgrep-wrapper

A wrapper for ripgrep that allows you to search for files in a directory and subdirectories.

The codes of this project are cherry picked from [vscode](https://github.com/microsoft/vscode). Thanks to the vscode and ripgrep.

## Usage

1. Install `ripgrep-wrapper` and `@vscode/ripgrep`

```bash
npm install ripgrep-wrapper @vscode/ripgrep
```

2. Use `ripgrep-wrapper` to search files

```typescript
import { rgPath } from '@vscode/ripgrep';
import { CancellationTokenSource, ITextQuery, TextSearchEngineAdapter } from 'ripgrep-wrapper';

const cts = new CancellationTokenSource()

// search query. refer to types/search#ITextQuery for more details
const query: ITextQuery = {
  contentPattern: {
    pattern: 'test'
  },
  folderQueries: [
    { folder: __dirname as any }
  ]
}

const searchEngine = new TextSearchEngineAdapter(rgPath, query)
const successResult = await searchEngine.search(cts.token, (res) => {
  console.log('onResult', res)
}, message => {
  console.log('onMessage', message)
})

console.log('successResult', successResult)
```
