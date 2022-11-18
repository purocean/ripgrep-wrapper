# ripgrep-wrapper

A wrapper for ripgrep that allows you to search for files in a directory and subdirectories.

The codes of this project are cherry picked from [vscode](https://github.com/microsoft/vscode). Thanks to the vscode and ripgrep.

## Usage

```typescript
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

const searchEngine = new TextSearchEngineAdapter(query)
const successResult = await searchEngine.search(cts.token, (res) => {
  console.log('onResult', res)
}, message => {
  console.log('onMessage', message)
})

console.log('successResult', successResult)
```
