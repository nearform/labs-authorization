const Reconfig = require('reconfig')

const resourcesConfig = new Reconfig({
  namespace: 'authorization',
  templates: {
    organizations: '/{{ namespace }}/organization/[organizationId]',
    teams: '/{{ namespace }}/team/[organizationId]/[teamId]',
    users: '/{{ namespace }}/user/[organizationId]/[teamId]/[userId]',
    policies: '/{{ namespace }}/policy/[organizationId]/[policyId]',
    'shared-policies': '/{{ namespace }}/shared-policy/[policyId]'
  }
}, {
  paramsInterpolation: ['[', ']'],
  envPrefix: 'UDARU_RESOURCES'
})

const Actions = {
  // organization
  CreateOrganization: 'authorization:organizations:create',
  UpdateOrganization: 'authorization:organizations:update',
  ReadOrganization: 'authorization:organizations:read',
  DeleteOrganization: 'authorization:organizations:delete',
  ListOrganizations: 'authorization:organizations:list',
  AddOrganizationPolicy: 'authorization:organizations:policy:add',
  AmendOrganizationPolicies: 'authorization:organizations:policy:amend',
  ReplaceOrganizationPolicy: 'authorization:organizations:policy:replace',
  RemoveOrganizationPolicy: 'authorization:organizations:policy:remove',
  ListOrganizationPolicies: 'authorization:organizations:policies',
  AllOrganization: 'authorization:organizations:*',

  // team
  CreateTeam: 'authorization:teams:create',
  UpdateTeam: 'authorization:teams:update',
  ReadTeam: 'authorization:teams:read',
  DeleteTeam: 'authorization:teams:delete',
  ListTeams: 'authorization:teams:list',
  SearchTeams: 'authorization:teams:search',
  SearchTeamsUsers: 'authorization:teams:users:search',
  ManageTeams: 'authorization:teams:manage',
  AddTeamPolicy: 'authorization:teams:policy:add',
  AmendTeamPolicies: 'authorization:teams:policy:amend',
  ReplaceTeamPolicy: 'authorization:teams:policy:replace',
  RemoveTeamPolicy: 'authorization:teams:policy:remove',
  AddTeamMember: 'authorization:teams:user:add',
  ReplaceTeamMember: 'authorization:teams:user:replace',
  RemoveTeamMember: 'authorization:teams:user:remove',
  AllTeam: 'authorization:teams:*',
  ListNestedTeams: 'authorization:teams:nestedlist',
  ListTeamPolicies: 'authorization:teams:policies',

  // user
  CreateUser: 'authorization:users:create',
  UpdateUser: 'authorization:users:update',
  ReadUser: 'authorization:users:read',
  DeleteUser: 'authorization:users:delete',
  ListUsers: 'authorization:users:list',
  SearchUsers: 'authorization:users:search',
  AddUserPolicy: 'authorization:users:policy:add',
  ReplaceUserPolicy: 'authorization:users:policy:replace',
  AmendUserPolicies: 'authorization:users:policy:amend',
  RemoveUserPolicy: 'authorization:users:policy:remove',
  ListUserTeams: 'authorization:users:teams:list',
  ReplaceUserTeams: 'authorization:users:teams:replace',
  DeleteUserTeams: 'authorization:users:teams:remove',
  AllUser: 'authorization:users:*',
  ListUserPolicies: 'authorization:users:policies',

  // policy
  CreatePolicy: 'authorization:policies:create',
  UpdatePolicy: 'authorization:policies:update',
  ReadPolicy: 'authorization:policies:read',
  DeletePolicy: 'authorization:policies:delete',
  ListPolicies: 'authorization:policies:list',
  SearchPolicies: 'authorization:policies:search',
  ReadPolicyVariables: 'authorization:policies:variables',
  AllPolicy: 'authorization:policies:*',

  // authorization
  CheckAccess: 'authorization:authn:access',
  ListActions: 'authorization:authn:actions',
  ListActionsOnResources: 'authorization:authn:resources:actions'
}

function getResource (type, data = {}) {
  const template = resourcesConfig.get(`templates.${type}`)

  const params = template
    .match(/[^[\]]+(?=])/g)
    .reduce((prev, match) => {
      const name = match.replace(/[[]]/g, '')
      return Object.assign(prev, { [name]: data[name] || '*' })
    }, {})

  return resourcesConfig.get(`templates.${type}`, params)
}

module.exports = {
  Action: Actions,
  resources: {
    organizations: getResource.bind(null, 'organizations'),
    teams: getResource.bind(null, 'teams'),
    users: getResource.bind(null, 'users'),
    policies: getResource.bind(null, 'policies'),
    'shared-policies': getResource.bind(null, 'shared-policies')
  }
}
