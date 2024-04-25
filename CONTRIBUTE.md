# Contribute

Pull requests are welcome, just make sure that you discuss important changes in an issue beforehand, then follow the coding style and run the tests before submitting.

Run all prepublishing checks at once:

    npm run prepublish

## Coding style

It is enforced by [eslint](https://eslint.org/) and configured in [.eslintrc.js](./.eslintrc.js), you should probably use a plugin to integrate it in your editor.

Check all rules:

    npm run lint

## Publishing

Release and publish usin npm:

```
npm version minor
npm publish
git push && git push --tags
```

To publish a beta version, use prerelease versioning with a npm tag:

```
npm version preminor --preid=beta # use prerelease instead of preminor to increment
npm publish --tag=beta
git push && git push --tags
```