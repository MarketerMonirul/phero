// import { compile } from "./testCompiler"

import ts from "typescript"

import { parseSamenApp, ParsedSamenApp } from "./parseSamenApp"
import { createTestProgram } from "../tsTestUtils"

function parseProgram(prog: ts.Program): ParsedSamenApp {
  // if (prog.getSemanticDiagnostics().length) {
  //   console.log("OEPS COMPILE ERRORS DETECTED")
  // }

  return parseSamenApp(prog.getSourceFile("samen.ts")!, prog.getTypeChecker())
}

function expectFunctionDeclrWithName(func: any, name: string) {
  expect(func?.name?.getText()).toBe(name)
  expect(func?.kind).toBe(ts.SyntaxKind.FunctionDeclaration)
}

function expectArrowFuncDeclrWithName(func: any, name: string) {
  expect(func?.name?.getText()).toBeUndefined()
  expect(func?.kind).toBe(ts.SyntaxKind.ArrowFunction)
}

function expectFunctionExpressionWithName(func: any, name: string | undefined) {
  expect(func?.name?.getText()).toBe(name)
  expect(func?.kind).toBe(ts.SyntaxKind.FunctionExpression)
}

function expectArrowFunctionWithName(func: any, name: string | undefined) {
  expect(func?.name?.getText()).toBe(name)
  expect(func?.kind).toBe(ts.SyntaxKind.ArrowFunction)
}

function expectFunctionDeclarationWithName(
  func: any,
  name: string | undefined,
) {
  expect(func?.name?.getText()).toBe(name)
  expect(func?.kind).toBe(ts.SyntaxKind.FunctionDeclaration)
}

describe("parseSamenApp middleware", () => {
  test("should parse middleware", () => {
    const parsedApp = parseProgram(
      createTestProgram(`
        type SamenNextFunction<T = void> = T extends void
          ? () => Promise<void>
          : (ctx: T) => Promise<void>

        type SamenContext<T = {}> = T
        type SamenParams<T = {}> = Partial<T>

        async function getArticle(aap: string, ctx: SamenContext<{ x: number }>): Promise<string> {
          return "ok"
        }

        async function myMiddleware(params: SamenParams, context: SamenContext, next: SamenNextFunction<{ x: number }) {
          await next({ x: 123 })
        }

        export const articleService = createService({
          getArticle,
        }, {
          middleware: [myMiddleware]
        })
      `),
    )

    expect(parsedApp).toMatchObject({
      services: [
        expect.objectContaining({
          name: "articleService",
          funcs: [
            expect.objectContaining({
              name: "getArticle",
            }),
          ],
        }),
      ],
    })

    expectFunctionDeclarationWithName(
      parsedApp.services[0].funcs[0].actualFunction,
      "getArticle",
    )
  })
})