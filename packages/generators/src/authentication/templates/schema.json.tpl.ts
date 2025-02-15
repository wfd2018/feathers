import { generator, toFile, when } from '@feathershq/pinion'
import { fileExists, renderSource } from '../../commons'
import { AuthenticationGeneratorContext, localTemplate } from '../index'

const template = ({
  cwd,
  lib,
  camelName,
  upperName,
  authStrategies,
  type,
  relative
}: AuthenticationGeneratorContext) => /* ts */ `// For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve, querySyntax, getValidator } from '@feathersjs/schema'${
  type === 'mongodb'
    ? `
import { ObjectIdSchema } from '@feathersjs/schema'`
    : ''
}
import type { FromSchema } from '@feathersjs/schema'
${localTemplate(authStrategies, `import { passwordHash } from '@feathersjs/authentication-local'`)}

import type { HookContext } from '${relative}/declarations'
import { dataValidator, queryValidator } from '${relative}/${
  fileExists(cwd, lib, 'schemas') ? 'schemas/' : '' // This is for legacy backwards compatibility
}validators'

// Main data model schema
export const ${camelName}Schema = {
  $id: '${upperName}',
  type: 'object',
  additionalProperties: false,
  required: [ '${type === 'mongodb' ? '_id' : 'id'}'${localTemplate(authStrategies, ", 'email'")} ],
  properties: {
    ${type === 'mongodb' ? `_id: ObjectIdSchema(),` : `id: { type: 'number' },`}
    ${authStrategies
      .map((name) =>
        name === 'local'
          ? `    email: { type: 'string' },
    password: { type: 'string' }`
          : `    ${name}Id: { type: 'string' }`
      )
      .join(',\n')}
  }
} as const
export type ${upperName} = FromSchema<typeof ${camelName}Schema>
export const ${camelName}Validator = getValidator(${camelName}Schema, dataValidator)
export const ${camelName}Resolver = resolve<${upperName}, HookContext>({})

export const ${camelName}ExternalResolver = resolve<${upperName}, HookContext>({
  ${localTemplate(
    authStrategies,
    `// The password should never be visible externally
  password: async () => undefined`
  )}
})

// Schema for creating new users
export const ${camelName}DataSchema = {
  $id: '${upperName}Data',
  type: 'object',
  additionalProperties: false,
  required: [  ],
  properties: {
    ...${camelName}Schema.properties
  }
} as const
export type ${upperName}Data = FromSchema<typeof ${camelName}DataSchema>
export const ${camelName}DataValidator = getValidator(${camelName}DataSchema, dataValidator)
export const ${camelName}DataResolver = resolve<${upperName}Data, HookContext>({
  ${localTemplate(authStrategies, `password: passwordHash({ strategy: 'local' })`)}
})

// Schema for updating existing users
export const ${camelName}PatchSchema = {
  $id: '${upperName}Patch',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    ...${camelName}Schema.properties
  }
} as const
export type ${upperName}Patch = FromSchema<typeof ${camelName}PatchSchema>
export const ${camelName}PatchValidator = getValidator(${camelName}PatchSchema, dataValidator)
export const ${camelName}PatchResolver = resolve<${upperName}Patch, HookContext>({
  ${localTemplate(authStrategies, `password: passwordHash({ strategy: 'local' })`)}
})

// Schema for allowed query properties
export const ${camelName}QuerySchema = {
  $id: '${upperName}Query',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...querySyntax(${camelName}Schema.properties)
  }
} as const
export type ${upperName}Query = FromSchema<typeof ${camelName}QuerySchema>
export const ${camelName}QueryValidator = getValidator(${camelName}QuerySchema, queryValidator)
export const ${camelName}QueryResolver = resolve<${upperName}Query, HookContext>({
  // If there is a user (e.g. with authentication), they are only allowed to see their own data
  ${type === 'mongodb' ? '_id' : 'id'}: async (value, user, context) => {
    if (context.params.user) {
      return context.params.user.${type === 'mongodb' ? '_id' : 'id'}
    }

    return value
  }
})
`

export const generate = (ctx: AuthenticationGeneratorContext) =>
  generator(ctx).then(
    when<AuthenticationGeneratorContext>(
      ({ schema }) => schema === 'json',
      renderSource(
        template,
        toFile(({ lib, folder, fileName }: AuthenticationGeneratorContext) => [
          lib,
          'services',
          ...folder,
          `${fileName}.schema`
        ]),
        { force: true }
      )
    )
  )
