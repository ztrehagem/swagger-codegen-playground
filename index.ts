import * as fs from 'fs'
import * as path from 'path'
import * as Parser from 'swagger-parser'
import { OpenAPIV3 } from 'openapi-types'
import * as handlebars from 'handlebars'
import * as glob from 'glob'

const ctx = {
  schemas: [] as Schema[],
  aliases: [] as TypeAlias[],
}

!(async () => {
  const filePath = path.resolve('./api-spec.yaml')
  const parser = new Parser()
  const parsed = await parser.parse(filePath) as OpenAPIV3.Document
  const refs = await parser.resolve(filePath)

  const schemas = parsed.components?.schemas
  if (schemas) {
    for (const [name, schema] of Object.entries(schemas)) {
      consumeSchema(name, schema as OpenAPIV3.NonArraySchemaObject)
    }
  }

  fs.mkdirSync(path.resolve('./out'), { recursive: true })

  const hbsPaths = glob
    .sync('**/*.hbs', { cwd: path.resolve('./hbs') })

  for (const relPath of hbsPaths) {
    const template = fs.readFileSync(path.resolve('./hbs', relPath)).toString()
    const rendered = handlebars.compile(template)(ctx)
    const { dir, name } = path.parse(relPath) // remove '.hbs' postfix
    fs.writeFileSync(path.resolve('./out', dir, name), rendered)
  }
})()

// enum Type {
//   number = 'number',
//   string = 'string',
//   boolean = 'boolean',
//   object = 'object',
//   schema = 'schema',
// }

interface Schema {
  typeName: TypeName
  optional?: boolean
}

interface Property {
  name: string
}

interface TypeAlias extends Schema {
  name: string
}

interface TypeName {
  name: string
  isNonPrimitive?: boolean
}

function consumeSchema(name: string, schema: OpenAPIV3.NonArraySchemaObject) {
  console.log(schema)

  switch (schema.type) {
    case 'integer':
    case 'number':
    case 'boolean':
    case 'string':
      const alias = parseAliasSchema(schema)
      if (alias) ctx.aliases.push({ ...alias, name })
      break
  }
  console.log('another')
}

function parseAliasSchema(schema: OpenAPIV3.NonArraySchemaObject): Schema | void {
  switch (schema.type) {
    case 'integer':
    case 'number':
      return { typeName: { name: 'number' }, optional: !!schema.nullable }
    case 'boolean':
      return { typeName: { name: 'boolean' }, optional: !!schema.nullable }
    case 'string':
      switch (schema.format) {
        case 'date':
          return { typeName: { name: 'DateString', isNonPrimitive: true }, optional: !!schema.nullable }
        case 'date-time':
          return { typeName: { name: 'DateTimeString', isNonPrimitive: true }, optional: !!schema.nullable }
        default:
          return { typeName: { name: 'string' }, optional: !!schema.nullable }
      }
  }
}
