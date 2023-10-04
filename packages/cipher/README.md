<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/cipher@1.0.0-alpha.1/packages/cipher#readme">@guanghechen/cipher</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/cipher">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/cipher.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/cipher">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/cipher.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/cipher">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/cipher.svg"
      />
    </a>
    <a href="#install">
      <img
        alt="Module Formats: cjs"
        src="https://img.shields.io/badge/module_formats-cjs-green.svg"
      />
    </a>
    <a href="https://github.com/nodejs/node">
      <img
        alt="Node.js Version"
        src="https://img.shields.io/node/v/@guanghechen/cipher"
      />
    </a>
    <a href="https://github.com/facebook/jest">
      <img
        alt="Tested with Jest"
        src="https://img.shields.io/badge/tested_with-jest-9c465e.svg"
      />
    </a>
    <a href="https://github.com/prettier/prettier">
      <img
        alt="Code Style: prettier"
        src="https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square"
      />
    </a>
  </div>
</header>
<br/>

Utility functions for cipher contents.


## Install

* npm

  ```bash
  npm install --save @guanghechen/cipher
  ```

* yarn

  ```bash
  yarn add @guanghechen/cipher
  ```

## Usage

* `AesCipher` / `AesCipherFactory`

  ```typescript
  import { AesGcmCipherFactory } from '@guanghechen/cipher'

  const cipherFactory = new AesGcmCipherFactory()
  const secret = cipherFactory.createRandomSecret()
  cipherFactory.initFromSecret(secret)
  const cipher = cipherFactory.cipher()

  // encrypt
  const originalContent = fs.readFileSync(sourceFilepath)
  const { cryptBytes, authTag } = cipher.encrypt(originalContent)

  // decrypt
  const plainBytes: Buffer = cipher.decrypt(cryptBytes, { authTag })
  ```



### Overview

Name                  | Description
:--------------------:|:----------------------------:
`AesGcmCipher`        | A ICipher implementation with AES-256-GCM algorithm.
`AesGcmCipherFactory` |


[homepage]: https://github.com/guanghechen/sora/tree/@guanghechen/cipher@1.0.0-alpha.1/packages/cipher#readme
