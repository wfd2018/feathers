import { generator, toFile, when } from '@feathershq/pinion'
import { fileExists, renderSource } from '../../commons'
import { AuthenticationGeneratorContext, localTemplate } from '../index'

export const template = ({
  cwd,
  lib,
  camelName,
  upperName,
  authStrategies,
  type,
  relative
}: AuthenticationGeneratorContext) => /* ts */ `// For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema'
import { Type, getValidator, querySyntax } from '@feathersjs/typebox'${
  type === 'mongodb'
    ? `
import { ObjectIdSchema } from '@feathersjs/typebox'`
    : ''
}
import type { Static } from '@feathersjs/typebox'
${localTemplate(authStrategies, `import { passwordHash } from '@feathersjs/authentication-local'`)}

import type { HookContext } from '${relative}/declarations'
import { dataValidator, queryValidator } from '${relative}/${
  fileExists(cwd, lib, 'schemas') ? 'schemas/' : '' // This is for legacy backwards compatibility
}validators'

// Main data model schema
export const ${camelName}Schema = Type.Object({
  ${type === 'mongodb' ? '_id: ObjectIdSchema()' : 'id: Type.Number()'},
  ${authStrategies
    .map((name) =>
      name === 'local'
        ? `  email: Type.String(),
  password: Type.Optional(Type.String())`
        : `    ${name}Id: Type.Optional(Type.String())`
    )
    .join(',\n')}
},{ $id: '${upperName}', additionalProperties: false })
export type ${upperName} = Static<typeof ${camelName}Schema>
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
export const ${camelName}DataSchema = Type.Pick(${camelName}Schema, [
  ${authStrategies.map((name) => (name === 'local' ? `'email', 'password'` : `'${name}Id'`)).join(', ')}
],
  { $id: '${upperName}Data', additionalProperties: false }
)
export type ${upperName}Data = Static<typeof ${camelName}DataSchema>
export const ${camelName}DataValidator = getValidator(${camelName}DataSchema, dataValidator)
export const ${camelName}DataResolver = resolve<${upperName}, HookContext>({
  ${localTemplate(authStrategies, `password: passwordHash({ strategy: 'local' })`)}
})

// Schema for updating existing users
export const ${camelName}PatchSchema = Type.Partial(${camelName}Schema, {
  $id: '${upperName}Patch'
})
export type ${upperName}Patch = Static<typeof ${camelName}PatchSchema>
export const ${camelName}PatchValidator = getValidator(${camelName}PatchSchema, dataValidator)
export const ${camelName}PatchResolver = resolve<${upperName}, HookContext>({
  ${localTemplate(authStrategies, `password: passwordHash({ strategy: 'local' })`)}
})

// Schema for allowed query properties
export const ${camelName}QueryProperties = Type.Pick(${camelName}Schema, ['${
  type === 'mongodb' ? '_id' : 'id'
}', ${authStrategies.map((name) => (name === 'local' ? `'email'` : `'${name}Id'`)).join(', ')}
])
export const ${camelName}QuerySchema = Type.Intersect([
  querySyntax(${camelName}QueryProperties),
  // Add additional query properties here
  Type.Object({}, { additionalProperties: false })
], { additionalProperties: false })
export type ${upperName}Query = Static<typeof ${camelName}QuerySchema>
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
      ({ schema }) => schema === 'typebox',
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
