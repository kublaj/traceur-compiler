import {
  createMemberExpression,
  createBinaryOperator,
  createOperatorToken,
  createTrueLiteral,
  createFalseLiteral,
  createNullLiteral
} from './src/codegeneration/ParseTreeFactory';
import {write} from './src/outputgeneration/TreeWriter';

var expr = createBinaryOperator(createTrueLiteral(), createOperatorToken('+'), createFalseLiteral());
var mem = createMemberExpression(expr, 'b');
console.log(write(mem));
