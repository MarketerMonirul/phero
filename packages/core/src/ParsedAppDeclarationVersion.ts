import ts from "typescript"
import { ParsedAppDeclaration } from "."
import { Model } from "./parseSamenApp"

export interface ParsedAppDeclarationVersion {
  domainModels: Model[]
  services: Array<{
    name: string
    models: Model[]
    functions: ts.FunctionLikeDeclarationBase[]
  }>
}

export function getDeclarationForVersion(
  app: ParsedAppDeclaration,
  version = "v_1_0_0",
): ParsedAppDeclarationVersion {
  console.log({ version, app })
  return {
    domainModels: app.domain[version]?.models ?? [],
    services: app.services.map((service) => ({
      name: service.name,
      models: service.versions[version].models,
      functions: service.versions[version].functions,
    })),
  }
}