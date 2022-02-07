# FlightSurety

FlightSurety is a sample application project for Udacity's Blockchain course.

## Prerequsites
- Node ^v16
- [optional] Docker (if you want to speed up contract compilation)

## Install

This repository contains Smart Contract code in Solidity (using Truffle), tests (also using Truffle), dApp scaffolding (using HTML, CSS and JS) and server app scaffolding.

To install, download or clone the repo, then run:

`npm install`


## Run Ganache CLI

You can either run:

`npm run ganache`

or run a different ethereum blockchain at port `7545` with mnemonic: 

`candy maple cake sugar pudding cream honey rich smooth crumble sweet treat`


## Run tests

The provided tests test all functionality, including oracles:

`npm run test`

## Deploy contracts

In order to work, the DApp and server need deployed contracts. 

`npm run migrate` or `npm run migrate:docker` if you have Docker installed on your system.


---
> **_NOTE:_**  With Ganache-CLI, the first deployment tends to fail, so just deploy the contracts one more time.
---


## Develop Server

To use and further develop the server (nodemon, watches for file changes and reloads):

`npm run server`

## Develop Client

To use and further develop the dapp (hot reload with webpack dev server):

`npm run dapp`

To view dapp:

`http://localhost:8000`


