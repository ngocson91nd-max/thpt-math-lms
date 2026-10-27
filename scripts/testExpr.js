/**
 * Test script for Pure JS TikZ to SVG rendering
 */

function parseMathExpr(expr, xVal) {
  let clean = expr
    .replace(/\\x/g, `(${xVal})`)
    .replace(/x/g, `(${xVal})`)
    .replace(/\^/g, '**');

  // Thay thế các hàm toán học
  clean = clean
    .replace(/exp\(/g, 'Math.exp(')
    .replace(/ln\(/g, 'Math.log(')
    .replace(/sin\(([^)]+) r\)/g, 'Math.sin($1)')
    .replace(/sin\(/g, 'Math.sin(')
    .replace(/cos\(([^)]+) r\)/g, 'Math.cos($1)')
    .replace(/cos\(/g, 'Math.cos(')
    .replace(/sqrt\(/g, 'Math.sqrt(')
    .replace(/abs\(/g, 'Math.abs(');

  try {
    const val = Function(`"use strict"; return (${clean});`)();
    return typeof val === 'number' && !isNaN(val) && isFinite(val) ? val : null;
  } catch (e) {
    return null;
  }
}

console.log('Test parseMathExpr:');
console.log('x = -2, 3/(x+1)^2 =', parseMathExpr('3/((\\x)+1)^2', -2));
console.log('x = 0, 3/(x+1)^2 =', parseMathExpr('3/((\\x)+1)^2', 0));
console.log('x = 2, x^3 - 3*x =', parseMathExpr('(\\x)^3 - 3*(\\x)', 2));
