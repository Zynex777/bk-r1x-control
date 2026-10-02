# BK-R1X — Protocolo WebHID (engenharia reversa)

Fonte: bundle Next.js de `https://bk-r1x.yjx2012.com` baixado em 2026-10-01
(`src_web/_next/static/chunks/app/page-51c144502f8589f3.js`, versão formatada em
`src_web/page.pretty.js`). Os números de linha abaixo se referem a `page.pretty.js`.

> **Status:** tudo aqui foi derivado do código JS do driver oficial, **não** de captura
> de pacotes reais. Campos marcados como *opaco* são constantes que o app original
> envia sem que o significado esteja claro; devem ser repetidos byte a byte.

---

## 1. Identificação do dispositivo

| Campo        | Valor                     | Observação |
|--------------|---------------------------|------------|
| `vendorId`   | `0xA8A4` (43172)          | Conexão **USB (cabo)** |
| `vendorId`   | `0xA8A5` (43173)          | Conexão **2.4G (dongle)** |
| `productId`  | `0x2255` (8789)           | Mesmo para ambos |
| `usagePage`  | `0xFF01` (65281)          | Vendor-defined |
| `usage`      | `0x10` (16)               | Filtro usado no `requestDevice` e no `getDevices` (l.61, l.3977) |
| `reportId`   | `0x00`                    | Output e input reports; sem feature reports em uso |

O modo de conexão é deduzido do VID: `43172 → "USB"`, qualquer outro → `"2.4G"` (l.241).

```ts
navigator.hid.requestDevice({ filters: [
  { vendorId: 0xA8A4, productId: 0x2255, usagePage: 0xFF01, usage: 0x10 },
  { vendorId: 0xA8A5, productId: 0x2255, usagePage: 0xFF01, usage: 0x10 },
]});
```

## 2. Transporte

- Todo comando é um buffer de **65 bytes** `[reportId=0, ...64 bytes de payload]`,
  zero-preenchido. Envio: `device.sendReport(0, payload /* 64 bytes */)` (l.164-171).
- Após cada envio o app **aguarda um input report** (resposta), com timeout de 500 ms
  (se estourar, resolve com `[]`) (l.43-55, l.330-355).
- Os comandos são **serializados numa fila**: nunca há dois em voo ao mesmo tempo (l.292-323).
- Neste documento, os offsets são **do payload de 64 bytes** (`p[0]` = primeiro byte
  depois do reportId). No código original, os índices de escrita são `p[i] = buffer[i+1]`.
- A resposta (`e.data` do `inputreport`) usa **os mesmos offsets do payload**: o campo
  escrito em `p[9]` volta em `r[9]`.

Cabeçalho comum do payload:

| Offset | Valor  | Significado |
|--------|--------|-------------|
| `p[0]` | `0x55` | Magic de comando host→mouse |
| `p[1]` | cmd    | Código do comando (par = leitura, ímpar = escrita, na maioria) |
| `p[2..7]` | ver cada comando | Endereço/tamanho (*opaco*) |

## 3. Comandos

### 3.1 Versão de firmware — `0x03`
```
TX: 55 03 00 00 00 00 00 00 ...
RX: r[23], r[24], r[25] = dígitos ASCII ('0'..'9')  → "X.Y.Z" (não dígito → '0')
```
(l.448-465)

### 3.2 Bateria — `0x30`
```
TX: 55 30 A5 0B 2E 01 01 00 00 00 ...
RX: r[8] = bateria (0–100 %), r[9] = charge_flag (1 = carregando)
```
(l.466-481). O app ignora o resultado se `battery_value == 0`.

### 3.3 Status online (mouse ↔ dongle) — `0xED`
```
TX: 55 ED 00 01 2E 00 00 ...
RX: r[8] == 2 → online; senão offline
```
(l.482-495). Relevante no modo 2.4G: o dongle pode estar conectado sem o mouse.

### 3.4 Ler configuração — `0x0E`
```
TX: 55 0E A5 0B 2F 01 01 00 00 00 ...
```
Resposta (l.536-594):

| Offset | Campo | Codificação |
|--------|-------|-------------|
| `r[9]`  | `light_mode` | 0–6 (ver §4.3) |
| `r[10]` | `report_rate` | **índice + 1** (1=125, 2=250, 3=500, 4=1000 Hz) |
| `r[11]` | `dpi_count` | Nº de estágios de DPI ativos (1–6) |
| `r[12]` | `dpi_index` | Estágio atual, **índice + 1** |
| `r[13..24]` | `dpi1..dpi6` | 6 × uint16 **little-endian** |
| `r[48]` | `scroll_flag` | 0 = normal, 1 = invertido |
| `r[49]` | `lod_value` | 1 = 1 mm, 2 = 2 mm |
| `r[50]` | `sensor_flag` | bitmask (ver §4.4) |
| `r[51]` | `key_respond` | Tempo de resposta/debounce do botão em ms (padrão 2) |
| `r[52]` | `sleep_light` | Minutos até dormir: 1,3,5,10,20,30,60 |
| `r[53]` | `highspeed_mode` | 0/1 ("Modo seguro de jogo"?) |
| `r[55]` | flags | nibble baixo = `wakeup_flag`, nibble alto = `move_light_flag` |

Se `r[13..15]` forem todos `0x00` ou todos `0xFF`, a memória está vazia; o app usa
os padrões de §5.

> ⚠️ **Assimetria de nibbles em `r[55]`/`p[54]`**: na leitura o original faz
> `wakeup = r[55] & 0xF; move_light = r[55] >> 4`, mas na escrita faz
> `p[54] = (wakeup << 4) | move_light`. Os nibbles ficam trocados entre leitura e
> escrita. Pode ser bug do original ou o firmware pode ser assimétrico mesmo; precisa
> de confirmação em hardware. O driver reproduz o comportamento **da escrita** original.

### 3.5 Gravar configuração — `0x0F`
Sempre grava o bloco inteiro (DPI + polling + LOD + sensor + sono...). Não existe
comando isolado de DPI ou polling: o app faz *read-modify-write* do objeto de config.
```
p[0..8]  = 55 0F AE 0A 2F 01 01 00 00
p[9]     = light_mode
p[10]    = report_rate_index + 1
p[11]    = dpi_count
p[12]    = dpi_index + 1
p[13..24]= dpi1..dpi6 (uint16 LE)
p[48]    = scroll_flag
p[49]    = lod_value
p[50]    = sensor_flag
p[51]    = key_respond
p[52]    = sleep_light
p[53]    = highspeed_mode
p[54]    = (wakeup_flag << 4) | move_light_flag
```
(l.690-727)

### 3.6 Modo de iluminação — `0x21`
```
TX: 55 21 00 00 03 00 00 00 00 00 MODE 00 ...      (MODE em p[10])
```
(l.496-511). **Só o modo é enviado.** O protocolo não tem cor, velocidade nem brilho.
O app também atualiza `light_mode` no objeto de config, mas não regrava a config.

### 3.7 Ler mapeamento de botões — `0x08`
```
TX: 55 08 A5 0B 20 00 00 00 00 00 ...
RX: r[8..39] = 8 botões × 4 bytes {type, code1, code2, code3}
```
(l.512-535). Entradas com `type` 0 ou 255 = não configurado (usa padrão).

### 3.8 Gravar mapeamento de botões — `0x09`
```
p[0..7] = 55 09 A5 22 20 00 00 00
p[8 + 4*i .. 8 + 4*i + 3] = {type, code1, code2, code3} do botão i (i = 0..7)
```
(l.595-644). "Resetar todos os botões" = o mesmo comando com a tabela padrão (§4.6).

### 3.9 Macros — `0x0D` (dados) + `0x10` (commit)
Upload em blocos de até 56 bytes (l.739-756):
```
para offset = 0; offset < len; offset += 56:
  TX: 55 0D 00 00 LEN OFF_LO OFF_HI 00 <LEN bytes>
commit:
  TX: 55 10 A5 22 00 00 00 05
```
O original reenvia **todas** as macros a cada alteração.

Formato do blob (função `eI`, l.2944-2963):
```
[0..63]   tabela de ponteiros: macro i → uint16 LE em [2i, 2i+1] (offset absoluto no blob)
[64..]    eventos, 4 bytes cada:
            [delay_lo, delay_hi, flags, code]
            delay  = ms (uint16 LE), aplicado depois do evento
            flags  = bit6 (0x40) = press  (sem o bit = release)
                     tipo: 0x03 = mouse, 0x02 = teclado, 0x04 = (tipo 3, desconhecido)
                     bit7 (0x80) = último evento da macro
            code   = mouse: bitmask de botão (1=L, 2=R, 4=M, 8=Back, 16=Fwd)
                     teclado: HID usage ID (ex.: A=0x04)
```
O blob é truncado no fim do último evento. Máximo: 4096 bytes; a tabela de 64 bytes comporta até 32 macros (ponteiros de 2 bytes).

Existem também `getMacroData` (`[6,12,...]`) e `resetMacroData` (`[6,15,4]`), que usam
reportId 6; parecem código morto (o app nunca os chama). **Não usar.**

## 4. Tabelas de valores

### 4.1 Polling rate
| Índice (`report_rate`) | Byte enviado | Hz |
|---|---|---|
| 0 | 1 | 125 |
| 1 | 2 | 250 |
| 2 | 3 | 500 |
| 3 | 4 | 1000 |

No **USB**, o app só oferece 1000 Hz e força o índice 3.

### 4.2 DPI
- Faixa 200–18000, passo 100 (l.2409-2445). 6 estágios, uint16 LE.
- Padrão: 800 / 1200 / 1600 / 3200 / 5000 / 18000, `dpi_count = 5`.
- **Cores por estágio** aparecem só na UI (`#ff0000`, `#00ff00`, `#0000ff`, `#ffff00`,
  `#00ffff`, `#800080`) e **não são enviadas ao mouse**: o protocolo não tem campo para elas.

### 4.3 Iluminação (`light_mode`)
| Valor | Efeito (pt) |
|---|---|
| 0 | Apagar luz (desligado) |
| 1 | Onda |
| 2 | Neon |
| 3 | Piscar em rotação |
| 4 | Yo-yo |
| 5 | Piscar unidirecional |
| 6 | Respiração cíclica |

### 4.4 `sensor_flag` (bitmask)
| Bit | Valor | Função |
|---|---|---|
| 0 | `0x01` | Controle de ondulação (ripple control) |
| 2 | `0x04` | desconhecido (ligado no padrão `53 = 0x35`), **preservar** |
| 4 | `0x10` | Correção linear (angle snapping) |
| 5 | `0x20` | Motion Sync |

### 4.5 Ações de botão `{type, code1, code2, code3}`
| type | Categoria | code1 / code2 / code3 |
|---|---|---|
| `0x20` (32) | Botão do mouse | code1 = bitmask: 1=L, 2=R, 4=M, 8=Voltar, 16=Avançar, 0=Desativado |
| `0x21` (33) | Função do mouse | `56,1` = Roda+; `56,255` = Roda−; `85,0` = Ciclo de DPI |
| `0x10` (16) | Teclado | code1 = modificadores (1=Ctrl, 2=Shift, 4=Alt, 8=Win, 16=RCtrl, 32=RShift, 64=RAlt); code2 = HID usage |
| `0x30` (48) | Multimídia (Consumer) | uint16 LE `code1 \| code2<<8` = Consumer usage (ex.: 0xE9 Vol+, 0xEA Vol−, 0xE2 Mudo, 0xCD Play/Pause, 0x192 Calculadora) |
| `0x70` (112) | Macro | code1 = índice da macro; code2 = nº de repetições; code3 = modo de loop (0 = N vezes, 2 = até soltar, 3 = até pressionar outra tecla; **1 = loop infinito, NÃO usar**) |
| `0xF0` (240) | DPI (padrão de fábrica do botão 5) | `1,1,0` |

> Obs.: na tabela original os identificadores internos `KC_VOLD`/`KC_VOLU` estão trocados,
> mas os rótulos e códigos estão certos (0xE9 = Volume +, 0xEA = Volume −).

> **Modo de loop 1: perigoso.** O app oficial só envia 0, 2 e 3. Testado em hardware em
> 2026-10-02: com `code3 = 1` a macro repete **infinitamente**. Apertar o mesmo botão ou outro
> botão não para; só desligar o mouse interrompe. Não existe modo "pressione de novo para
> parar" no firmware. O app converte qualquer `code3` fora de {0, 2, 3} para 0.

### 4.6 Layout padrão dos 8 botões
| i | Botão | Padrão |
|---|---|---|
| 0 | Esquerdo | `20 01 00 00` (o app não deixa remapear) |
| 1 | Direito | `20 02 00 00` |
| 2 | Meio | `20 04 00 00` |
| 3 | Voltar | `20 08 00 00` |
| 4 | Avançar | `20 10 00 00` |
| 5 | DPI | `21 55 00 00` (no comando de reset) / `F0 01 01 00` (no JSON padrão) |
| 6 | Roda + | `21 38 01 00` |
| 7 | Roda − | `21 38 FF 00` |

## 5. Configuração padrão (restaurar fábrica)
```
light_mode=0, report_rate=3 (1000Hz), dpi_index=3, dpi_count=5,
dpi=[800,1200,1600,3200,5000,18000], scroll_flag=0, lod_value=1,
sensor_flag=53, key_respond=2, sleep_light=10, highspeed_mode=0,
wakeup_flag=1, move_light_flag=1
```
Restaurar = `0x09` com a tabela padrão + `0x0F` com a config acima + `0x21` com o modo 0 (l.1259-1286).

## 6. Input reports não solicitados (mouse → host)
Tratados em `addListeners` (l.416-441), sobre `e.data` (sem reportId):

| Condição | Significado | Dados |
|---|---|---|
| `d[0]=0xAA, d[1]=0xFA, d[8]=0xD0` | Bateria | `d[9]` = %, `d[10]` = charge_flag |
| `d[0]=0xAA, d[1]=0xFA, d[8]≠0xD0` | Status (botão DPI/polling pressionado no mouse) | `d[9]-1` = dpi_index, `d[10]-1` = report_rate |
| `d[0]=0xAA, d[1]=0xED` | Online/offline | `d[8]==2` → online |
| `d[0]=0x13, d[1]=0xE2` | Pareamento ("match") | sem payload útil |

Como o original usa o mesmo `inputreport` para respostas e eventos, uma resposta de comando
pode ser confundida com um evento e vice-versa. O driver novo trata isso: dentro de uma
transação, o primeiro report que **não** começa com `AA FA`/`AA ED`/`13 E2` é a resposta.

## 7. Lacunas / o que não existe no protocolo
- **Cor, brilho e velocidade de RGB:** não existem; só há o modo (0–6).
- **Cor por estágio de DPI:** só na UI.
- **Debounce:** existe `key_respond` (ms, padrão 2), com rótulo "Atraso de resposta do
  botão (milisegundos)" nas traduções, mas o original não expõe controle nem lista de
  valores válidos. Faixa segura não confirmada.
- **LOD:** só 1 mm / 2 mm; o painel está escondido (`hidden`) na UI original.
- **Polling > 1000 Hz:** não suportado.
