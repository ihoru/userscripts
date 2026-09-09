# Personal userscripts

Author: [Igor Polyakov](https://github.com/ihoru).

Private source backup for browser userscripts. Scripts run locally in the browser and contain no GitHub credentials. This repository does not store imported vocabulary or account data.

## Scripts

| Script | Description | Installation |
| --- | --- | --- |
| [DuoCards Auto Import](duocards-auto-import/) | Automatically saves loaded import cards and resets duplicate progress. | [ZIP import instructions](duocards-auto-import/README.md#install-without-copying-code) |

## Repository layout

Each userscript has its own folder containing its `.user.js` source, tests, README, and `.install.zip` archive. Add future scripts in separate folders and list them above.

Run `python3 build-archives.py` to rebuild all installation archives from their sources. Archives contain only the corresponding script, without extension settings or stored data. Generated archives are committed so they can be downloaded and imported without a build step.

Installation uses Tampermonkey's **Dashboard → Utilities → ZIP → Choose File** flow. See each script's README for the exact file and update steps.
