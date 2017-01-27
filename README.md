# Udaru
[![npm][npm-badge]][npm-url]
[![travis][travis-badge]][travis-url]
[![coveralls][coveralls-badge]][coveralls-url]
[![snyk][snyk-badge]][snyk-url]

Udaru is a policy based authorization module that can be used to add permissions to 'actions' and 
'resources'. Udaru supports 'organizations', 'teams', and 'users'; policies can be created for 
each. Udaru can be used as a [stand-alone module]() , or as a [stand-alone server]() or 
[Hapi plugin](). This repository contains the code for all three running configurations.

## Install
To install via npm,

```
npm install udaru
```

## Testing, benching & linting
Before running tests, ensure a valid Postgres database is running. The simplest way to do this is
via Docker. Assuming docker is installed on your machine, in the root folder, run,

```
docker-compose up
```

This will start a postgress database. Running test or coverage runs will automaticaly populate the
database with the information it needs.

To run tests,

```
npm run test
```

To lint the repository,

```
npm run lint
```

To fix (most) linting issues,

```
npm run lint -- --fix
```

To run a bench test on a given route,

```
npm run bench -- "METHOD swagger/route/template/path"
```

To obtain a coverage report,

```
npm run coverage
```

## Usage

### Stand-alone module
```js
const Udaru = require('udaru') // or

...
```

### Stand alone server
```
npm run start
```

### Hapi plugin
```js
const Hapi = require('hapi')
const UdaruPlugin = require('udaru/hapi-plugin')

...

const server = new Hapi.server()
server.register({register: UdaruPlugin})
```

## Database

**Important note:** the app needs PostgreSQL >= 9.5

Running the initial demo (first cut of the service) uses Postgres in a Docker running instance, 
which can be created with:

```
npm run pg:build
```

Note: In case you have issues building or running it with Docker make sure you have a recent 
version of docker engine and docker compose.

### Start Postgres in a Docker container

A Docker container with Postgres can be started with:
```
npm run pg:start
```

To see the running container and its ID:
```
docker ps
```

To connect to the running container:
```
docker exec -ti <container_id> <command>
```
e.g.
```
docker exec -ti e343edecaaa7 ls
docker exec -ti e343edecaaa7 bash
docker exec -ti e bash        // short container name
```

### Populate the database

The Authorization database, system user and initial tables
can be created by executing:

```
npm run pg:init
```

Test data can be added with:
```
npm run pg:load-test-data
```

### pgAdmin database access

As the Postgresql docker container has its 5432 port forwarded on the local machine the database 
can be accessed with pgAdmin.

To access the database using the pgAdmin you have to fill in also the container IP beside the 
database names and access credentials. The container IP can be seen with `docker ps`.

### Migrations

For testing and documentation purposes we have db migrations.

We use [`postgrator`][postgrator] and you can find the sql files in the [`database/migrations`](/database/migrations) folder.

To run the migrations you just need to execute

`node database/migrate.js --version=<version>`

Running the tests (`npm test`) or setting up the app with the test db (`npm run app:init-test-db`) will automaticcaly bring the db to the latest version.

## Service

The service will respond http calls such as

```
GET /authorization/users
```

with data in the form:

```
[
  { id: 'CharlieId', name: 'Charlie Bucket' },
  { id: 'GrandpaId', name: 'Grandpa Joe' },
  { id: 'VerucaId', name: 'Veruca Salt' },
  { id: 'WillyId', name: 'Willy Wonka' }
]
```

To get more information see [Service Api documentation](#service-api-documentation)

## Setup SuperUser

The init script needs to be run in order to setup the SuperUser: `node service/scripts/init`

If you want to specify a better SuperUser id (default is `SuperUserId`) you can prefix the script as follow:

```
LABS_AUTH_SERVICE_authorization_superUser_id=myComplexId12345 node service/scripts/init
```

**Note:** if you have already ran some tests or loaded the test data, you will need to run `npm pg:init` again to reset the db.

## Load policies from file

Another script is available to load policies from a file

Usage: `node service/script/loadPolicies --org=FOO policies.json`

JSON structure:

```
{
  "policies": [
    {
      "id": "unique-string", // <== optional
      "version": "",
      "name": "policy name",
      "organizationId": "your_organization" // <== optional, if present will override the "--org=FOO" parameter
      "statements": [
        {
          "Effect": "Allow/Deny",
          "Action": "act",
          "Resource": "res"
        },
        { /*...*/ }
      ]
    },
    { /*...*/ }
  ]
}
```

## Service API documentation

The Swagger API documentation gives explanations on the exposed API.

To run Swagger:

```
npm run start
```

and then go to [`http://localhost:8080/documentation`][swagger-link]

The Swagger documentation also gives the ability to execute calls to the API and see their results.



## ENV variables to set configuration options

There is a default configuration file [`service/lib/config.js`][config].

This configuration is the one used in dev environment and we are quite sure the production one will 
be different :) To override this configuration you can use ENV variables on the 
server/container/machine you will run the app(s) on.

To override those configuration settings you will have to specify your ENV variables with a 
[prefix][prefix-link] and then the "path" to the property you want to override.

**Configuration**
```
{
  security: {
    api: {
      servicekeys: {
        private: [
          '123456789'
        ]
      }
    }
  }
}
```

**ENV variable override**
```
LABS_AUTH_SERVICE_security_api_servicekeys_private_0=jerfkgfjdedfkg3j213i43u31jk2erwegjndf
```

To achieve this we use the [`reconfig`][reconfig] module


## License
Copyright nearForm Ltd 2017. Licensed under [MIT][license]

[config]: https://github.com/nearform/labs-authorization/blob/master/lib/config.js
[license]: ./LICENSE.md
[postgrator]: https://github.com/rickbergfalk/postgrator
[prefix-link]: https://github.com/nearform/labs-authorization/blob/master/lib/config.js#L29
[reconfig]: https://github.com/namshi/reconfig
[swagger-link]: http://localhost:8080/documentation

[travis-badge]: https://travis-ci.org/nearform/labs-authorization.svg?branch=master
[travis-url]: https://travis-ci.org/nearform/labs-authorization
[npm-badge]: https://badge.fury.io/js/labs-authorization.svg
[npm-url]: https://npmjs.org/package/labs-authorization
[logo-url]: https://raw.githubusercontent.com/nearform/labs-authorization/master/assets/labs-authorization.png
[coveralls-badge]: https://coveralls.io/repos/nearform/labs-authorization/badge.svg?branch=master&service=github
[coveralls-url]: https://coveralls.io/github/nearform/labs-authorization?branch=master
[snyk-badge]: https://snyk.io/test/github/nearform/labs-authorization/badge.svg
[snyk-url]: https://snyk.io/test/github/nearform/labs-authorization
