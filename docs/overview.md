# Udaru - PBAC Authorization Service. 

![Udaru](./logo.jpg) Udaru is an Authorization Service designed for use in modern day microservice based Platforms/Solutions. Technically it's a Policy Based Access Control (PBAC) model, heavily inspired by Access Management in [AWS IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction_access-management.html). 

It supports Organizations, Teams and User entities that are used to build the access model. The policies attached to these entities define the 'Actions' that can be performed by an entity on various 'Resources'.

Udaru can be used as a stand-alone module, as a stand-alone server or as a Hapi plugin. 


## Background

Access control management evolved from the need to mitigate the risk of unauthorized access to data. Several control models were built over time to approach the various access control needs: Access Control Lists, Role Based Access Control, Attribute Based Access Control, Policy Based Access Control, Risk Adaptive Access Control. A great summary of this evolution can be found is this [survey on access control models](http://csrc.nist.gov/news_events/privilege-management-workshop/PvM-Model-Survey-Aug26-2009.pdf). 

## Core Udaru API Concepts

Udaru effectively has two interfaces:
*   A REST API for managing Organizations, Teams, Users, and associated Policies - this is called the _Management_ API
*   A REST API for managing Authorization access itself - this is called the _Authorization_ API

Both have different use cases and are used in a Platform in a fundamentally different manner. Note the Udaru API can be used directly as a normal node module, but also has a REST API (a Hapi plugin is provided), and it can also be used out of the box as a standalone server.

All requests to Udaru need to attach a User ID to all endpoint requests. The User ID must be passed in the http headers as the `authorization` field. Knowing the User ID, Udaru retrieves internally data about the User like: Organization ID to which the user belongs to, Teams to which the User belongs to, Policies attached to it or its parent hierarchy elements. This data is used at middleware level to authorize the User to access the endpoint and then evaluate the endpoint request (to manage the authorization model or to check if an Action can be performed over a Resource).

## Management API 

The Management API is used to build sophisticated Administration Tools and Applications. It's used to manage Organization, Teams, Users and their associated Policies in a Platform. Its designed in such a way that the calls in the Management API can be easily proxied directly from the public API gateway straight through to Udaru:


![Udaru Management API](./udaru/Management.png)

In the example above:
*   An administration tool (or tools) are built to mange aspects of the platform. These can be user facing or internal platform configuration, and they are always solution specific. 
*   These admin tools typically manage Users; their account details, and optionally which Teams and Organizations they belong to - again this is always solution specific
*   These admin tools also typically manage a Users access rights and permissions, although typically not directly via policies, i.e. there might be an option to allow a user access to a specific part of the solution, this would be encapsulated in a high level api call (e.g. `allowFooAccessToBar`) which in its implementation attaches platform specific policies to the user under the hood.

A brief overview of the Management API calls are as follows, see the [Swagger Documentation](swagger/index.html ":ignore") documentation for full details:

|Method|Endpoint|Description|
|------|--------|-----------|
|get|/authorization/organizations|List all the organizations|
|post|/authorization/organizations|Create an organization|
|get|/authorization/policies|Fetch all the defined policies|
|post|/authorization/policies|Create a policy for the current user organization|
|get|/authorization/teams|Fetch all teams from the current user organization|
|post|/authorization/teams|Create a team|
|get|/authorization/users|Fetch all users from the current user organization|
|post|/authorization/users|Create a new user|
|get|/authorization/organizations/{id}|Get organization|
|delete|/authorization/organizations/{id}|DELETE an organization|
|put|/authorization/organizations/{id}|Update an organization|
|get|/authorization/teams/{id}|Fetch a team given its identifier|
|delete|/authorization/teams/{id}|Delete a team|
|put|/authorization/teams/{id}|Update a team|
|get|/authorization/users/{id}|Fetch a user given its identifier|
|delete|/authorization/users/{id}|Delete a user|
|put|/authorization/users/{id}|Update a user|
|get|/authorization/teams/{id}/users|Fetch team users given its identifier|
|post|/authorization/teams/{id}/users|Replace team users with the given ones|
|delete|/authorization/teams/{id}/users|Delete all team users|
|put|/authorization/teams/{id}/users|Add team users|
|post|/authorization/organizations/{id}/policies|Clear and replace the policies of an organization|
|delete|/authorization/organizations/{id}/policies|Clear all policies of the organization|
|put|/authorization/organizations/{id}/policies|Add one or more policies to an organization|
|post|/authorization/teams/{id}/policies|Clear and replace policies for a team|
|delete|/authorization/teams/{id}/policies|Clear all team policies|
|put|/authorization/teams/{id}/policies|Add one or more policies to a team|
|post|/authorization/users/{id}/policies|Clear and replace policies for a user|
|delete|/authorization/users/{id}/policies|Clear all user's policies|
|put|/authorization/users/{id}/policies|Add one or more policies to a user|
|post|/authorization/users/{id}/teams|Clear and replace user teams|
|delete|/authorization/users/{id}/teams|Delete teams for a user|
|delete|/authorization/organizations/{id}/policies/{policyId}|Remove a policy from one organization|
|delete|/authorization/teams/{teamId}/policies/{policyId}|Remove a team policy|
|delete|/authorization/teams/{id}/users/{userId}|Delete one team member|
|delete|/authorization/users/{userId}/policies/{policyId}|Remove a user's policy|
|put|/authorization/teams/{id}/nest|Nest a team|
|put|/authorization/teams/{id}/unnest|Unnest a team|


## Authorization API

The Authorization API is used to check user permissions as they access Platform resources. This API is intended to be called from a trusted service; they should never be called directly by user facing API. One suggested usage pattern is to call the Authorization API from your public API Gateway, i.e. for each protected call through your gateway, check if the user is firstly Authenticated, then check if they are Authorized, e.g.

![Udaru Authorization API](./udaru/Authorization.png)

In the example above:

*   User makes a request from a solution application
*   The REST API Gateway first checks if the User is Authenticated, for example, if Auth0 is used for Authentication, it checks the JWT token
*   If the User is authenticated ok, next check if the user is authorized to perform the operation. This is done by the Gateway making a call to the `access` endpoint.
*   If the User is authorized ok, proceed in making the original call

These trusted calls are made possible by the use of a _service key_, e.g. the Gateway in our example above is configured to pass a secret service key to Udaru; it's not possible to access any of the Authorization API without this service key. You must also use the special root user id when making these service calls, this is an additional security measure. 

A brief overview of the Authorization API calls are as follows, see the live [Swagger](../README.md) documentation for full details:

|Method|Endpoint|Description|
|------|--------|-----------|
|get|/authorization/access/{userId}/{action}/{resource*}|Authorize user action against a resource|
|get|/authorization/policies/{id}|Fetch all the defined policies|
|delete|/authorization/policies/{id}|Delete a policy|
|put|/authorization/policies/{id}|Update a policy of the current user organization|
|get|/authorization/list/{userId}/{resource*}|List all the actions a user can perform on a resource|
|get|/authorization/list/{userId}|List all the actions a user can perform on a given list of resources|


## How the Authorization model works

The PBAC model can be built using the **Organization**, **Team** and **User** entities. The usual modeling case is to build independent organizations, each organization having teams (or nested teams) attached to them and users attached to teams. Policies are attached to Organizations, Teams or Users.

**Policies** can be attached to Teams, Users and Organizations. The policy engine evaluates all policies from all levels when establishing if a User can perform an Action on a Resource.

**Important note:** Teams, Users and Policies can't be shared across Organizations.

A policy is a document that describes the type of access that the policy owner has to a resource or a group of resources. Given the policies, the action to perform and a resource, the engine returns `true` if the action is authorized, `false` otherwise.

Users can have policies attached to themselves, or inherit them from their Team(s) and Organization.

A policy looks like:

```javascript
{
  id: 'Policy ID',
  version: '2016-07-01',
  name: 'Policy name',
  statements: { Statement: [{
    Effect: 'Allow',
    Action: ['Documents:Read'],
    Resource: ['wonka:documents:/public/*']
  }] }
}
```

The main elements of a policy are:
-   The policy ID
-   The policy version
-   The policy name
-   The policy statements that contains an array of statements.

The main elements of a Statement are:
-   The Action to be performed. Example: `'authorization:teams:create'` or `'authorization:organizations:*'`
-   The Resource on which the action is performed. A Resource name is effectively a URI for your resources. Example: `'FOO:orga:CLOUDCUCKOO:scenario:*:entity:north-america-id'`
-   The Effect - has the value 'Allow' or 'Deny'.

Note that wildcards can be used in Action and Resource names, as can certain variables, see [IAM Policy Variables Overview](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_variables.html) for more details.

For a detailed description of Policies, see the [AWS Policy Elements Reference](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements.html).

## Super User

In Udaru all operations are performed in the organization context: for each user request Udaru finds the organization to which the user belongs to and from there all middleware checks and element queries are made in the organization context. One user can't perform operations outside the organization to which it belongs to. The user identifier is passed in the Http headers as the `authorization` field.

There is a special type of Udaru users, SuperUsers, that belong to the 'ROOT' organization. SuperUsers can be assigned full access rights on all actions on all resources. To be able to do operations as SuperUser on an Organization, Udaru provides an impersonation functionality: by passing in the Http headers an 'org' field, the endpoint request is made as if the SuperUser belongs to the 'org' organization thus having acess to all the exposed Udaru functionality for that organization (like user management, team management).

curl impersonation example in which a SuperUser impersonates an user belonging to the `WONKA` organization:
```javascript
curl -X PUT --header 'Content-Type: application/json' --header 'Accept: application/json' --header 'authorization: ROOTID' --header 'org: WONKA' -d '{"policies":["PolicyID"]}' 'http://localhost:8080/authorization/teams/TeamID/policies'
```

# Next Steps

To get a feel for the Udaru APIs and sample usage, see a very contrived example [here](./example.md). 

To get up and running with Udaru, see the installation steps in the [README](https://github.com/nearform/udaru/).
