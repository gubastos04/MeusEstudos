/**
 * Worker que executa exercicios de SQL usando sql.js (SQLite em WebAssembly).
 *
 * Decisoes:
 * - roda em Worker pelo mesmo motivo do Python: uma consulta cartesiana sobre
 *   tabela grande travaria a tela inteira, e `terminate()` e a unica forma
 *   confiavel de interromper;
 * - o banco e criado em memoria a cada execucao, e o esquema vem do proprio
 *   codigo da pessoa. Isso e deliberado: ela ve os dados que esta consultando,
 *   em vez de consultar um banco invisivel;
 * - o resultado da ULTIMA consulta do script fica disponivel como a view
 *   `resposta`. E o que permite o caso de teste ser SQL comum
 *   (`SELECT count(*) FROM resposta`) em vez de uma linguagem de asserção
 *   propria;
 * - `expectThrows` passa quando o comando falha. E assim que se testa
 *   restricao de verdade: inserir duplicata numa coluna UNIQUE DEVE falhar,
 *   e isso e execucao, nao casamento de padrao.
 *
 * Convencao do valor de retorno de um caso, para `expected` caber em JSON:
 * - 1 linha e 1 coluna  -> o valor sozinho;
 * - N linhas e 1 coluna -> lista de valores;
 * - o resto            -> lista de linhas, cada linha uma lista.
 */

export const SQL_WORKER_SOURCE = String.raw`
'use strict';

var sqlReady = null;

function loadRuntime(baseUrl) {
  if (sqlReady) return sqlReady;
  sqlReady = (async function () {
    importScripts(baseUrl + 'sql-wasm.js');
    return await initSqlJs({
      locateFile: function (arquivo) {
        return baseUrl + arquivo;
      }
    });
  })();
  return sqlReady;
}

/**
 * Divide o script em comandos, respeitando string, string com aspas duplas e
 * comentario de linha e de bloco. Split em ';' puro quebraria em qualquer
 * ponto e virgula dentro de texto.
 */
function dividirComandos(codigo) {
  var comandos = [];
  var atual = '';
  var i = 0;

  while (i < codigo.length) {
    var c = codigo[i];
    var proximo = codigo[i + 1];

    if (c === '-' && proximo === '-') {
      var fimLinha = codigo.indexOf('\n', i);
      if (fimLinha < 0) break;
      atual += ' ';
      i = fimLinha + 1;
      continue;
    }

    if (c === '/' && proximo === '*') {
      var fimBloco = codigo.indexOf('*/', i + 2);
      i = fimBloco < 0 ? codigo.length : fimBloco + 2;
      atual += ' ';
      continue;
    }

    if (c === "'" || c === '"') {
      var aspas = c;
      atual += c;
      i++;
      while (i < codigo.length) {
        atual += codigo[i];
        if (codigo[i] === aspas) {
          // Aspas dobrada dentro da string e escape, nao fechamento.
          if (codigo[i + 1] === aspas) {
            atual += codigo[i + 1];
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    if (c === ';') {
      comandos.push(atual);
      atual = '';
      i++;
      continue;
    }

    atual += c;
    i++;
  }

  if (atual.trim().length > 0) comandos.push(atual);
  return comandos.filter(function (comando) {
    return comando.trim().length > 0;
  });
}

function ehConsulta(comando) {
  var limpo = comando.trim().toLowerCase();
  return limpo.indexOf('select') === 0 || limpo.indexOf('with') === 0;
}

function valorDoResultado(resultado) {
  if (!resultado || resultado.length === 0) return null;

  var primeiro = resultado[0];
  var linhas = primeiro.values || [];
  var colunas = primeiro.columns || [];

  if (colunas.length === 1) {
    if (linhas.length === 1) return linhas[0][0];
    return linhas.map(function (linha) {
      return linha[0];
    });
  }

  return linhas;
}

function iguais(a, b) {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    return Math.abs(a - b) < 1e-9;
  }
  // SQLite devolve numero onde o JSON do conteudo pode ter texto, e vice-versa.
  if ((typeof a === 'number' && typeof b === 'string') || (typeof a === 'string' && typeof b === 'number')) {
    return String(a) === String(b);
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (!iguais(a[i], b[i])) return false;
    }
    return true;
  }
  return false;
}

function formatar(valor) {
  try {
    return JSON.stringify(valor);
  } catch (erro) {
    return String(valor);
  }
}

self.onmessage = async function (event) {
  var payload = event.data || {};
  var id = payload.id;

  try {
    var SQL = await loadRuntime(payload.baseUrl);
    var db = new SQL.Database();
    var resposta = { erroCarregamento: null, resultados: [], saida: '' };
    var avisos = [];

    var comandos = dividirComandos(String(payload.code || ''));

    try {
      for (var i = 0; i < comandos.length; i++) {
        db.run(comandos[i]);
      }
    } catch (erro) {
      resposta.erroCarregamento = 'O SQL não executou: ' + (erro && erro.message ? erro.message : String(erro));
      self.postMessage({ id: id, ok: true, payload: resposta });
      db.close();
      return;
    }

    // A ultima consulta do script e materializada na tabela resposta, com uma
    // coluna __ordem que guarda a ordem em que as linhas sairam. View nao
    // serviria: SQLite nao garante a ordem ao reconsultar, e ORDER BY e
    // justamente uma das coisas que o exercicio de SQL precisa testar.
    var ultimaConsulta = null;
    for (var j = comandos.length - 1; j >= 0; j--) {
      if (ehConsulta(comandos[j])) {
        ultimaConsulta = comandos[j].trim();
        break;
      }
    }

    if (ultimaConsulta) {
      try {
        var bruta = db.exec(ultimaConsulta);
        var colunas = bruta.length > 0 ? bruta[0].columns : [];
        var linhas = bruta.length > 0 ? bruta[0].values : [];

        if (colunas.length === 0) {
          avisos.push('A última consulta não devolveu coluna nenhuma.');
        } else {
          var aspas = colunas.map(function (nome) {
            return '"' + String(nome).replace(/"/g, '""') + '"';
          });

          db.run('CREATE TABLE resposta (' + aspas.join(', ') + ', "__ordem")');

          var marcadores = colunas
            .map(function () {
              return '?';
            })
            .concat('?')
            .join(', ');
          var inserir = db.prepare('INSERT INTO resposta VALUES (' + marcadores + ')');
          for (var l = 0; l < linhas.length; l++) {
            inserir.run(linhas[l].concat(l + 1));
          }
          inserir.free();
        }
      } catch (erro) {
        avisos.push(
          'A última consulta não pôde ser usada como resposta: ' + (erro && erro.message ? erro.message : '')
        );
      }
    }

    var casos = payload.cases || [];
    for (var k = 0; k < casos.length; k++) {
      var caso = casos[k];
      var item = {
        name: caso.name,
        passed: false,
        expected: null,
        received: null,
        message: null,
        hidden: caso.hidden === true
      };

      try {
        var bruto = db.exec(caso.expression);
        var valor = valorDoResultado(bruto);
        item.received = formatar(valor);

        if (caso.expectThrows === true) {
          item.expected = 'que o comando falhasse';
          item.passed = false;
        } else {
          item.expected = formatar(caso.expected === undefined ? null : caso.expected);
          item.passed = iguais(valor, caso.expected === undefined ? null : caso.expected);
        }
      } catch (erro) {
        var texto = erro && erro.message ? erro.message : String(erro);
        if (caso.expectThrows === true) {
          item.passed = true;
          item.expected = 'que o comando falhasse';
          item.received = texto;
        } else {
          item.passed = false;
          item.message = texto;
          item.expected = formatar(caso.expected === undefined ? null : caso.expected);
        }
      }

      resposta.resultados.push(item);
    }

    db.close();
    resposta.saida = avisos.join('\n');
    self.postMessage({ id: id, ok: true, payload: resposta });
  } catch (error) {
    self.postMessage({
      id: id,
      ok: false,
      message: error && error.message ? error.message : 'Não foi possível iniciar o SQLite.'
    });
  }
};
`
