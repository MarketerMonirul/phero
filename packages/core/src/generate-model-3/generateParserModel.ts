import ts from "typescript"
import { ParseError } from "../domain/errors"
import { getTypeFlags } from "../generate-model-2/generateParserModelUtils"
import {
  EnumMemberParserModel,
  EnumParserModel,
  IndexMemberParserModel,
  MemberParserModel,
  ObjectParserModel,
  ParserModel,
  ParserModelType,
} from "../generate-model-2/ParserModel"

export interface ParserModelMap {
  root: ParserModel
  deps: Record<string, ParserModel>
}

export function generateParserModel(
  func: ts.FunctionDeclaration,
  prog: ts.Program,
): ParserModelMap {
  const typeChecker = prog.getTypeChecker()

  const funcType = func.type

  if (!funcType) {
    throw new ParseError("Function must have type", func)
  }

  return { root: generate(funcType, typeChecker) as any, deps: {} }
}

function generate(
  typeNode: ts.TypeNode,
  typeChecker: ts.TypeChecker,
): ParserModel {
  if (ts.isTokenKind(typeNode.kind)) {
    switch (typeNode.kind) {
      case ts.SyntaxKind.AnyKeyword:
        return { type: ParserModelType.Any }
      case ts.SyntaxKind.BigIntKeyword:
        return { type: ParserModelType.BigInt }
      case ts.SyntaxKind.BooleanKeyword:
        return { type: ParserModelType.Boolean }
      case ts.SyntaxKind.FalseKeyword:
        return { type: ParserModelType.BooleanLiteral, literal: false }
      case ts.SyntaxKind.NullKeyword:
        return { type: ParserModelType.Null }
      case ts.SyntaxKind.NumberKeyword:
        return { type: ParserModelType.Number }
      case ts.SyntaxKind.StringKeyword:
        return { type: ParserModelType.String }
      case ts.SyntaxKind.TrueKeyword:
        return { type: ParserModelType.BooleanLiteral, literal: true }
      case ts.SyntaxKind.UndefinedKeyword:
        return { type: ParserModelType.Undefined }
      case ts.SyntaxKind.UnknownKeyword:
        return { type: ParserModelType.Any }
      case ts.SyntaxKind.VoidKeyword:
        return { type: ParserModelType.Undefined }

      case ts.SyntaxKind.ObjectKeyword:
      case ts.SyntaxKind.SymbolKeyword:
      // TODO?
      default:
        throw new Error(`TokenKind ${typeNode.kind} not implemented`)
    }
  }

  if (ts.isLiteralTypeNode(typeNode)) {
    switch (typeNode.literal.kind) {
      case ts.SyntaxKind.NullKeyword:
        return { type: ParserModelType.Null }
      case ts.SyntaxKind.TrueKeyword:
        return { type: ParserModelType.BooleanLiteral, literal: true }
      case ts.SyntaxKind.FalseKeyword:
        return { type: ParserModelType.BooleanLiteral, literal: false }
      case ts.SyntaxKind.StringLiteral: {
        const stringType = typeChecker.getTypeAtLocation(
          typeNode,
        ) as ts.StringLiteralType
        return {
          type: ParserModelType.StringLiteral,
          literal: stringType.value,
        }
      }
      case ts.SyntaxKind.NumericLiteral: {
        const numberType = typeChecker.getTypeAtLocation(
          typeNode,
        ) as ts.NumberLiteralType
        return {
          type: ParserModelType.NumberLiteral,
          literal: numberType.value,
        }
      }
      case ts.SyntaxKind.BigIntLiteral: {
        const bigIntType = typeChecker.getTypeAtLocation(
          typeNode,
        ) as ts.BigIntLiteralType
        return {
          type: ParserModelType.BigIntLiteral,
          literal: bigIntType.value,
        }
      }
      case ts.SyntaxKind.RegularExpressionLiteral:
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
      case ts.SyntaxKind.JsxAttributes:
      case ts.SyntaxKind.ObjectLiteralExpression:
      case ts.SyntaxKind.PrefixUnaryExpression:
      default:
        throw new Error(`Literal ${typeNode.literal.kind} not implemented`)
    }
  }

  if (ts.isArrayTypeNode(typeNode)) {
    return {
      type: ParserModelType.Array,
      element: {
        type: ParserModelType.ArrayElement,
        parser: generate(typeNode.elementType, typeChecker),
      },
    }
  }

  if (ts.isUnionTypeNode(typeNode)) {
    return {
      type: ParserModelType.Union,
      oneOf: typeNode.types.map((type) => generate(type, typeChecker)),
    }
  }

  if (ts.isIntersectionTypeNode(typeNode)) {
    return {
      type: ParserModelType.Intersection,
      parsers: typeNode.types.map((type) => generate(type, typeChecker)),
    }
  }

  if (ts.isParenthesizedTypeNode(typeNode)) {
    return generate(typeNode.type, typeChecker)
  }

  if (ts.isTupleTypeNode(typeNode)) {
    return {
      type: ParserModelType.Tuple,
      elements: typeNode.elements.map((element, position) => ({
        type: ParserModelType.TupleElement,
        position,
        parser: generate(element, typeChecker),
      })),
    }
  }

  if (ts.isTypeLiteralNode(typeNode)) {
    return {
      type: ParserModelType.Object,
      members: typeNode.members.map((member) =>
        generateMemberParserModel(member, typeChecker),
      ),
    }
  }

  if (ts.isTypeReferenceNode(typeNode)) {
    // TODO this section should actually return a ParserModelType.Reference
    // for now implementing the parsers for the reference types here as far as possible

    const symbol = typeChecker.getSymbolAtLocation(typeNode.typeName)
    // const type = typeChecker.getTypeAtLocation(typeNode)
    const declaration = symbol?.declarations?.[0]

    if (declaration) {
      if (ts.isEnumDeclaration(declaration)) {
        return getEnumParserModelFromDeclaration(declaration, typeChecker)
      } else if (ts.isEnumMember(declaration)) {
        return getEnumMemberParserModelFromDeclaration(declaration, typeChecker)
      } else if (ts.isInterfaceDeclaration(declaration)) {
        return getObjectParserModelFromDeclaration(declaration, typeChecker)
      }
    }
  }

  throw new ParseError("Not implemented", typeNode)
}

function getObjectParserModelFromDeclaration(
  interfaceDeclr: ts.InterfaceDeclaration,
  typeChecker: ts.TypeChecker,
): ObjectParserModel {
  return {
    type: ParserModelType.Object,
    members: interfaceDeclr.members.map((member) =>
      generateMemberParserModel(member, typeChecker),
    ),
  }
}

function generateMemberParserModel(
  member: ts.TypeElement,
  typeChecker: ts.TypeChecker,
): MemberParserModel | IndexMemberParserModel {
  if (ts.isPropertySignature(member)) {
    if (!member.type) {
      throw new ParseError("Member must have a type", member)
    }
    return {
      type: ParserModelType.Member,
      name: getMemberNameAsString(member),
      optional: !!member.questionToken,
      parser: generate(member.type, typeChecker),
    }
  } else if (ts.isIndexSignatureDeclaration(member)) {
    if (!member.type) {
      throw new ParseError("Member must have a type", member)
    }
    // TODO IndexMember
  }
  throw new ParseError("Member type is not supported", member)
}

function getEnumParserModelFromDeclaration(
  enumDeclr: ts.EnumDeclaration,
  typeChecker: ts.TypeChecker,
): EnumParserModel {
  return {
    type: ParserModelType.Enum,
    name: enumDeclr.name.text,
    members: enumDeclr.members.map((member) =>
      getEnumMemberParserModelFromDeclaration(member, typeChecker),
    ),
  }
}

function getEnumMemberParserModelFromDeclaration(
  member: ts.EnumMember,
  typeChecker: ts.TypeChecker,
): EnumMemberParserModel {
  const enumValueType = typeChecker.getTypeAtLocation(member)
  const memberParser = typeToParserModel(enumValueType)
  if (
    memberParser.type !== ParserModelType.NumberLiteral &&
    memberParser.type !== ParserModelType.StringLiteral
  ) {
    throw new ParseError(
      "Enum member should be either of type string or number",
      member,
    )
  }
  return {
    type: ParserModelType.EnumMember,
    name: propertyNameAsString(member.name),
    parser: memberParser,
  }
}

function typeToParserModel(type: ts.Type): ParserModel {
  if (type.flags & ts.TypeFlags.StringLiteral) {
    const s = type as ts.StringLiteralType
    return {
      type: ParserModelType.StringLiteral,
      literal: s.value,
    }
  }
  if (type.flags & ts.TypeFlags.NumberLiteral) {
    const s = type as ts.NumberLiteralType
    return {
      type: ParserModelType.NumberLiteral,
      literal: s.value,
    }
  }

  throw new Error(
    `ParserModel for Type with flags (${getTypeFlags(type).join(
      " | ",
    )}) not implemented`,
  )
}

function getMemberNameAsString(member: ts.TypeElement): string {
  const memberName = member.name

  if (!memberName) {
    throw new ParseError("Member has no name", member)
  }

  return propertyNameAsString(memberName)
}

function propertyNameAsString(propertyName: ts.PropertyName): string {
  if (ts.isIdentifier(propertyName)) {
    return propertyName.text
  }
  if (ts.isStringLiteral(propertyName)) {
    return propertyName.text
  }
  if (ts.isNumericLiteral(propertyName)) {
    return propertyName.text
  }
  if (ts.isComputedPropertyName(propertyName)) {
    throw new ParseError(
      "Member name must not be computed property",
      propertyName,
    )
  }

  if (ts.isPrivateIdentifier(propertyName)) {
    throw new ParseError(
      "Member name must not be private identifier",
      propertyName,
    )
  }

  throw new ParseError(`Unexpected value for member name`, propertyName)
}
