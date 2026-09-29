/**
 * Worker que executa exercicios de Python usando Pyodide (CPython em WebAssembly).
 *
 * Decisoes:
 * - roda em Worker, e nao na thread principal, porque Pyodide bloqueia enquanto
 *   executa: um laco infinito na aula congelaria a tela inteira;
 * - o runtime e baixado sob demanda (alguns megabytes) e a interface avisa antes,
 *   porque o celular pode estar em rede movel;
 * - o Worker e reaproveitado entre execucoes para nao baixar tudo de novo.
 */

export const PYTHON_WORKER_SOURCE = String.raw`
'use strict';

var pyodideReady = null;

function loadRuntime(indexUrl) {
  if (pyodideReady) return pyodideReady;
  pyodideReady = (async function () {
    importScripts(indexUrl + 'pyodide.js');
    var py = await loadPyodide({ indexURL: indexUrl });
    return py;
  })();
  return pyodideReady;
}

var PREP = [
  'import json, sys, io, traceback',
  '',
  'def __rodar(codigo, casos):',
  '    ambiente = {"__name__": "__main__"}',
  '    saida = io.StringIO()',
  '    original = sys.stdout',
  '    sys.stdout = saida',
  '    resposta = {"erroCarregamento": None, "resultados": [], "saida": ""}',
  '    try:',
  '        try:',
  '            exec(codigo, ambiente)',
  '        except Exception as erro:',
  '            resposta["erroCarregamento"] = type(erro).__name__ + ": " + str(erro)',
  '            return json.dumps(resposta)',
  '        for caso in casos:',
  '            item = {"name": caso["name"], "passed": False, "expected": None, "received": None, "message": None, "hidden": caso.get("hidden", False)}',
  '            espera_erro = caso.get("expectThrows", False)',
  '            try:',
  '                valor = eval(caso["expression"], ambiente)',
  '                item["received"] = __formatar(valor)',
  '                if espera_erro:',
  '                    item["expected"] = "que levantasse uma exceção"',
  '                    item["passed"] = False',
  '                else:',
  '                    esperado = json.loads(caso["expectedJson"])',
  '                    item["expected"] = __formatar(esperado)',
  '                    item["passed"] = __igual(valor, esperado)',
  '            except Exception as erro:',
  '                texto = type(erro).__name__ + ": " + str(erro)',
  '                if espera_erro:',
  '                    item["passed"] = True',
  '                    item["expected"] = "que levantasse uma exceção"',
  '                    item["received"] = texto',
  '                else:',
  '                    item["passed"] = False',
  '                    item["message"] = texto',
  '                    if not espera_erro:',
  '                        item["expected"] = __formatar(json.loads(caso["expectedJson"]))',
  '            resposta["resultados"].append(item)',
  '    finally:',
  '        sys.stdout = original',
  '    resposta["saida"] = saida.getvalue()',
  '    return json.dumps(resposta)',
  '',
  'def __formatar(valor):',
  '    try:',
  '        return json.dumps(valor, ensure_ascii=False, default=str)',
  '    except Exception:',
  '        return repr(valor)',
  '',
  'def __igual(a, b):',
  '    if isinstance(a, bool) or isinstance(b, bool):',
  '        return a is b',
  '    if isinstance(a, (int, float)) and isinstance(b, (int, float)):',
  '        return abs(a - b) < 1e-9',
  '    if isinstance(a, dict) and isinstance(b, dict):',
  '        if set(a.keys()) != set(b.keys()):',
  '            return False',
  '        return all(__igual(a[k], b[k]) for k in a)',
  '    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):',
  '        if len(a) != len(b):',
  '            return False',
  '        return all(__igual(x, y) for x, y in zip(a, b))',
  '    if isinstance(a, set) and isinstance(b, (set, list)):',
  '        return a == set(b)',
  '    return a == b',
  ''
].join('\n');

self.onmessage = async function (event) {
  var payload = event.data || {};
  var id = payload.id;

  try {
    var py = await loadRuntime(payload.indexUrl);
    py.runPython(PREP);

    var casos = (payload.cases || []).map(function (caso) {
      return {
        name: caso.name,
        expression: caso.expression,
        expectedJson: JSON.stringify(caso.expected === undefined ? null : caso.expected),
        expectThrows: caso.expectThrows === true,
        hidden: caso.hidden === true
      };
    });

    py.globals.set('__codigo_usuario', String(payload.code || ''));
    py.globals.set('__casos_json', JSON.stringify(casos));
    var bruto = py.runPython('__rodar(__codigo_usuario, json.loads(__casos_json))');
    self.postMessage({ id: id, ok: true, payload: JSON.parse(bruto) });
  } catch (error) {
    self.postMessage({
      id: id,
      ok: false,
      message: error && error.message ? error.message : 'Não foi possível iniciar o Python.'
    });
  }
};
`
