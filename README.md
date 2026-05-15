# TimeDepthCurve — Guia de uso

Este aplicativo serve para comparar a curva **Tempo x Profundidade** planejada do poço contra a curva real obtida a partir de dados exportados da Pason.

O objetivo é responder rapidamente:

```text
Estamos adiantados ou atrasados em relação ao projeto?
```

---

## 1. Carregar o plano

Na área **Arquivo CSV do plano**, selecione o arquivo do plano do poço.

O arquivo precisa ter pelo menos:

- uma coluna de tempo;
- uma coluna de profundidade.

Depois de carregar o arquivo, selecione:

- **Eixo X / Tempo**
- **Eixo Y / Profundidade**

O gráfico será plotado como:

```text
Eixo X: Tempo (dias)
Eixo Y: Profundidade (m)
```

A profundidade aumenta para baixo, como normalmente usamos em curva Tempo x Profundidade.

---

## 2. Informar o Spud

No campo **Spud / Data e hora**, informe a data e hora real do início do poço.

Esse campo é essencial para comparar os dados reais da Pason com o plano.

Exemplo:

```text
10/05/2026 07:30
```

A partir desse horário, o app calcula o tempo transcorrido em dias.

---

## 3. Ajustar o grid do gráfico

Você pode configurar:

- **Grid X / dias**
- **Grid Y / metros**

Sugestão inicial:

```text
Grid X: 4 dias
Grid Y: 200 m
```

Esses campos servem apenas para melhorar a visualização do gráfico.

---

## 4. Carregar os dados reais da Pason

Na área de importação dos dados reais, selecione o CSV exportado da Pason.

O app espera que o arquivo tenha:

- coluna de data;
- coluna de hora;
- coluna de profundidade real, normalmente chamada:

```text
Hole Depth (meters)
```

Depois de carregar o CSV, selecione as colunas corretas nos campos correspondentes.

O app junta data + hora, compara com o **Spud** e calcula o tempo real transcorrido em dias.

---

## 5. Interpretar o gráfico

O gráfico mostra:

- curva do **Plano**;
- curva **Real / Pason**;
- pontos manuais, quando cadastrados;
- linha de profundidade final do projeto.

A leitura principal é:

```text
Se a curva real estiver à esquerda do plano: tendência de adiantamento.
Se a curva real estiver à direita do plano: tendência de atraso.
```

---

## 6. Resultado de atraso ou adiantamento

O app calcula a diferença entre o tempo real efetivo e o tempo planejado na profundidade atual.

Exemplo:

```text
+1,25 dias = atrasado
-0,80 dias = adiantado
0,00 dias = no plano
```

O resultado é exibido em dias com duas casas decimais.

---

## 7. Avaliação rápida manual

Use a **Avaliação rápida manual** quando você ainda não tiver um novo CSV atualizado da Pason, mas quiser adicionar uma medição rápida.

Você deve informar:

- data/hora da captura;
- profundidade medida.

Regra importante:

```text
A captura manual precisa ser posterior ao último dado importado da Pason.
```

Se depois um novo CSV da Pason cobrir o horário dessa captura manual, o app desconsidera automaticamente o ponto manual.

Esse ponto muda de status e deixa de entrar no cálculo.

---

## 8. Flat time nas capturas manuais

Na tabela de **Avaliação rápida manual**, cada ponto pode ser marcado como **Flat time**.

Quando o flag estiver ativado, aparece um campo de texto para descrever o motivo do flat time.

Exemplos de descrição:

- descida de revestimento;
- cimentação;
- armado ou teste de BOP;
- perfilagem;
- manutenção planejada;
- espera operacional relevante.

Nesta versão, o campo serve para registrar o significado operacional do flat time junto ao ponto manual.

---

## 9. Dados salvos automaticamente

O app salva no navegador:

- plano importado;
- dados reais importados;
- spud date;
- configuração dos eixos;
- pontos manuais;
- flat times.

Ao abrir a página novamente no mesmo navegador, os dados anteriores devem ser recuperados automaticamente.

Para apagar tudo, use o botão **Limpar**.

---

## 10. Cuidados importantes

- Confira sempre se o **Spud** está correto.
- Confira se as colunas selecionadas estão corretas.
- Verifique visualmente se a curva real faz sentido.
- Não use ponto manual com horário anterior ao último dado Pason.
- Cadastre flat time apenas quando realmente quiser descontar/congelar esse período da comparação.
- Se o CSV da Pason for atualizado, revise os pontos manuais desconsiderados.

---

## 11. Uso recomendado

Fluxo sugerido:

```text
1. Carregar plano.
2. Informar spud.
3. Carregar CSV da Pason.
4. Conferir o gráfico.
5. Registrar flat times reais, se existirem.
6. Usar avaliação manual somente se ainda não houver CSV atualizado.
7. Atualizar a Pason periodicamente.
8. Observar o atraso/adiantamento em dias.
```

---

## 12. Limitações

Este app é uma ferramenta rápida de acompanhamento operacional.

Ele não substitui análise detalhada de performance, NPT, KPI ou relatório oficial.

A qualidade do resultado depende diretamente da qualidade dos dados importados e do correto cadastro dos flat times.
