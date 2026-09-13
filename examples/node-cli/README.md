# Node CLI

A command-line fleet manager built on [tesdk](../../). Signs in through a real
browser OAuth flow, caches tokens on disk, and drives vehicles and energy sites
from the terminal.

```
$ npm start -- status

Dev Car
  VIN               5YJ3E1EA1JF000001
  State             ● online
  Battery           █████████████████░░░░░░░ 72%
  Range             231 mi (372 km)
  Charging          Charging
  Rate              11 kW
  Charge limit      80%
  Climate           on  inside 21.5°C  outside 14°C
```

## Setup

```sh
npm install                 # from the repository root
cp .env.example .env        # then fill in TESLA_CLIENT_ID
npm start -- login
```

`login` prints a URL, waits on `http://localhost:8788/callback` for the
redirect, and writes the tokens to `~/.config/tesdk-cli/tokens.json` with mode
`600`. The redirect URI must match one registered on your Tesla application.

## Commands

| Command | Description |
| --- | --- |
| `login` | Authorize in a browser and cache the tokens |
| `logout` | Discard the cached tokens |
| `whoami` | Signed-in account and its assigned region |
| `vehicles` | List vehicles and connectivity state |
| `status [vin] [--wake]` | Charge, climate, and location summary |
| `watch [vin] [--interval=30]` | Poll charge state until interrupted |
| `fleet-status` | Which vehicles require signed commands |
| `lock` · `unlock` | Lock or unlock the doors |
| `honk` · `flash` | Sound the horn, flash the lights |
| `charge-start` · `charge-stop` | Control charging |
| `climate-on` · `climate-off` | Control climate |
| `charge-limit [vin] <50-100>` | Set the charge limit |
| `wake [vin]` | Wake the vehicle |
| `energy` | Live power flow for each energy site |

The VIN is optional when the account has exactly one vehicle.

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `TESLA_CLIENT_ID` | yes | Application client id |
| `TESLA_CLIENT_SECRET` | for confidential clients | Application secret |
| `TESLA_REGION` | no | `na`, `eu`, or `cn`. Defaults to `na` |
| `TESLA_REDIRECT_URI` | no | Defaults to `http://localhost:8788/callback` |
| `TESLA_PROXY_URL` | for signed commands | Vehicle Command Proxy address |
| `TESLA_DEBUG` | no | Log every HTTP attempt |

## Signed commands

Vehicles from 2021 onward reject unsigned commands. Check which of yours do:

```sh
npm start -- fleet-status
```

For any marked `proxy required`, run Tesla's
[Vehicle Command Proxy](https://github.com/teslamotors/vehicle-command) and
point the CLI at it:

```sh
TESLA_PROXY_URL=https://localhost:4443 npm start -- lock
```

Without it, those commands raise `SigningRequiredError`, which the CLI reports
along with this remedy.

## What this example shows

- **Browser OAuth with PKCE** — [`src/login.ts`](src/login.ts) runs a
  short-lived loopback server, validates `state`, and exchanges the code
- **Persistent tokens** — [`src/config.ts`](src/config.ts) implements
  `TokenStore` over a mode-600 file, so refresh survives restarts
- **Wake handling** — commands use `withWake`, which retries once after waking
  a sleeping vehicle
- **Command rejection vs. failure** — a `result: false` payload prints
  `rejected <reason>` rather than throwing
- **Typed error handling** — [`src/main.ts`](src/main.ts) maps `TeslaError` to
  an exit code and surfaces `requestId` for Tesla support

## Files

```
src/
  main.ts       Entry point, dispatch, error-to-exit-code mapping
  commands.ts   Command implementations
  login.ts      OAuth flow with a loopback callback server
  config.ts     Environment config and the file-backed token store
  ui.ts         Terminal formatting: colour, spinner, bars
```
