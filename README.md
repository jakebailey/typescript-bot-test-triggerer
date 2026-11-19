# `@typescript-bot x y`

This repo is the code for the bot which powers the comment commands inside microsoft/TypeScript. You can see [all of the commands here](https://github.com/microsoft/TypeScript/wiki/Triggering-TypeScript-Bot) and the bot is deployed to Azure as a [Function App here](https://ms.portal.azure.com/#@microsoft.onmicrosoft.com/resource/subscriptions/57bfeeed-c34a-4ffd-a06b-ccff27ac91b8/resourceGroups/typescriptbot-github3/providers/Microsoft.Web/sites/typescriptbot-github3/appServices).

## Azure DevOps permissions

The bot queues Azure DevOps pipelines using the Function App's managed
identity. Grant that identity these permissions on each pipeline it runs:

- **View builds** (`1`)
- **View build pipeline** (`2`)
- **Queue builds** (`128`)
- **Edit queue build configuration** (`65536`), required to set free-text
  (`string`) runtime parameters when queuing a run

Grant all four permissions (`1 + 2 + 128 + 65536 = 65667`) in the Build
security namespace (`33344d9c-fc72-4d6f-aba5-fa317101a7e9`):

```sh
az devops security permission update \
  --org https://dev.azure.com/<org> \
  --id 33344d9c-fc72-4d6f-aba5-fa317101a7e9 \
  --subject <identity descriptor> \
  --token <project ID>/<pipeline folder path>/<pipeline ID> \
  --allow-bit 65667
```

Look up `<identity descriptor>` with `az devops user list`. In `--token`,
separate folders with `/` and omit `<pipeline folder path>/` for root
pipelines (`<project ID>/<pipeline ID>`).

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see
the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com)
with any additional questions or comments.
