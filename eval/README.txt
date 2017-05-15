

Installed Azure CLI

https://docs.microsoft.com/en-us/cli/azure/install-azure-cli

curl -L https://aka.ms/InstallAzureCli | bash

=====================

** Login to azure

az login

(will prompt you to enter a code in a website)

spits out:

[
  {
    "cloudName": "AzureCloud",
    "id": "4c2f7fe8-0eba-4e60-8eec-8fdc9312b825",
    "isDefault": true,
    "name": "JS",
    "state": "Enabled",
    "tenantId": "e7f936f9-7a01-4915-bad3-3a66af6d488c",
    "user": {
      "name": "jslegare@cs.ubc.ca",
      "type": "user"
    }
  }
]

============= Pool setup

** Created resource group for tests

$ az group create --name "twistor-eval" --location westus2

{
  "id": "/subscriptions/4c2f7fe8-0eba-4e60-8eec-8fdc9312b825/resourceGroups/twistor-eval",
  "location": "westus2",
  "managedBy": null,
  "name": "twistor-eval",
  "properties": {
    "provisioningState": "Succeeded"
  },
  "tags": null
}

