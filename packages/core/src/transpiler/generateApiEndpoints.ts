import path from "path"
import { Project, ts } from "ts-morph"
import { SamenConfig } from "../domain/config"
import { SamenManifest } from "../domain/manifest"
import { ApiEndpointCompilerError, validateProject } from "../errors"
import * as paths from "../paths"
import apiEndpoint from "./templates/apiEndpoint"

export default async function generateApiEndpoints(
  manifest: SamenManifest,
  samenFilePath: string,
  config: SamenConfig,
): Promise<void> {
  try {
    const userProjectPath = process.cwd()

    const relativeSamenFilePath = `./${path
      .relative(userProjectPath, samenFilePath)
      .replace(/(.+)\..+$/, "$1")}`

    const project = new Project({
      compilerOptions: {
        outDir: paths.userRpcFunctionsDir,
        declaration: true,
      },
    })

    for (const rpcFunction of manifest.rpcFunctions) {
      const code = apiEndpoint({
        manifest,
        relativeSamenFilePath,
        rpcFunction,
        config,
      })
      project.createSourceFile(`${rpcFunction.name}.ts`, code)
    }

    validateProject(project)

    await project.emit()
  } catch (error) {
    throw new ApiEndpointCompilerError(error)
  }
}
