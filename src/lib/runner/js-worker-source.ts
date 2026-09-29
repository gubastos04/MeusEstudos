/**
 * Codigo do Web Worker que executa exercicios de JavaScript.
 *
 * Por que um Worker criado a partir de Blob:
 * - roda fora da thread da interface, entao um laco infinito nao trava a tela;
 * - pode ser encerrado de fora (timeout) — a unica forma confiavel de parar
 *   codigo em loop;
 * - nao tem acesso ao DOM nem aos cookies da pagina.
 *
 * Limite honesto: um Worker compartilha origem com a pagina, portanto isto
 * protege a EXPERIENCIA (travar, demorar), nao e sandbox de seguranca. Como o
 * codigo executado e o da propria pessoa, no navegador dela, o risco e dela
 * mesma. Nada de codigo de usuario roda no servidor.
 */

export const JS_WORKER_SOURCE = String.raw`
'use strict';

function format(value, depth) {
  depth = depth || 0;
  if (depth > 4) return '...';
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  var type = typeof value;
  if (type === 'string') return depth === 0 ? value : JSON.stringify(value);
  if (type === 'number' || type === 'boolean') return String(value);
  if (type === 'function') return 'function ' + (value.name || 'anonima');
  if (type === 'symbol' || type === 'bigint') return String(value);
  if (Array.isArray(value)) {
    var items = value.slice(0, 20).map(function (item) { return format(item, depth + 1); });
    if (value.length > 20) items.push('... +' + (value.length - 20));
    return '[' + items.join(', ') + ']';
  }
  if (value instanceof Error) return value.name + ': ' + value.message;
  if (value instanceof Map) return 'Map(' + value.size + ')';
  if (value instanceof Set) return 'Set(' + value.size + ')';
  try {
    var keys = Object.keys(value).slice(0, 20);
    return '{ ' + keys.map(function (key) {
      return key + ': ' + format(value[key], depth + 1);
    }).join(', ') + ' }';
  } catch (error) {
    return String(value);
  }
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    // Tolerancia para ponto flutuante: 0.1 + 0.2 nao deve reprovar ninguem.
    if (Number.isFinite(a) && Number.isFinite(b)) return Math.abs(a - b) < 1e-9;
    return false;
  }
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  var keysA = Object.keys(a);
  var keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (var j = 0; j < keysA.length; j += 1) {
    var key = keysA[j];
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

self.onmessage = function (event) {
  var payload = event.data || {};
  var code = String(payload.code || '');
  var cases = Array.isArray(payload.cases) ? payload.cases : [];
  var output = [];

  function write(level, args) {
    if (output.length > 200) return;
    var line = Array.prototype.slice.call(args).map(function (item) { return format(item); }).join(' ');
    output.push(level === 'error' ? '! ' + line : line);
  }

  var fakeConsole = {
    log: function () { write('log', arguments); },
    info: function () { write('log', arguments); },
    warn: function () { write('log', arguments); },
    error: function () { write('error', arguments); },
    debug: function () { write('log', arguments); },
    table: function () { write('log', arguments); }
  };

  var evaluate;
  try {
    // O eval direto dentro do corpo da funcao enxerga as declaracoes do codigo
    // da pessoa (function, let, const), o que permite testar por expressao.
    var factory = new Function(
      'console',
      '"use strict";\n' + code + '\n;return function (__expressao) { return eval(__expressao); };'
    );
    evaluate = factory(fakeConsole);
  } catch (error) {
    self.postMessage({
      ok: false,
      stage: 'carregamento',
      message: error && error.message ? error.name + ': ' + error.message : 'Erro ao carregar o código.',
      output: output
    });
    return;
  }

  var results = [];
  for (var index = 0; index < cases.length; index += 1) {
    var testCase = cases[index] || {};
    var name = String(testCase.name || 'caso ' + (index + 1));
    var expectThrows = testCase.expectThrows === true;
    try {
      var received = evaluate(String(testCase.expression || ''));
      if (expectThrows) {
        results.push({
          name: name,
          passed: false,
          expected: 'que lançasse um erro',
          received: format(received),
          hidden: testCase.hidden === true
        });
      } else {
        var passed = deepEqual(received, testCase.expected);
        results.push({
          name: name,
          passed: passed,
          expected: format(testCase.expected),
          received: format(received),
          hidden: testCase.hidden === true
        });
      }
    } catch (error) {
      var message = error && error.message ? error.name + ': ' + error.message : String(error);
      results.push({
        name: name,
        passed: expectThrows,
        expected: expectThrows ? 'que lançasse um erro' : format(testCase.expected),
        received: expectThrows ? message : undefined,
        message: expectThrows ? undefined : message,
        hidden: testCase.hidden === true
      });
    }
  }

  self.postMessage({ ok: true, results: results, output: output });
};
`
