import logoSvg from '@/assets/importa-flow-logo.svg?raw';
import {
  formatPriceBRL,
  getBoxPrice,
  getCartLineTotal,
  getUnitPrice,
} from '@/lib/productPricing';
import { formatOrderDisplayId } from '@/lib/orderDisplay';
import type { Order } from '@/types';

const IMPORTA_FLOW_LOGO_DATA_URL = `data:image/svg+xml,${encodeURIComponent(logoSvg.trim())}`;

export type OrderExportClientInfo = {
  name?: string;
  address?: string;
  cnpj?: string;
  phone?: string;
  email?: string;
};

export type OrderExportTransportadora = {
  name: string;
  phone?: string;
  city?: string;
  state?: string;
};

export type OrderExportOptions = {
  client?: OrderExportClientInfo;
  transportadora?: OrderExportTransportadora | null;
  onSuccess?: (message: string) => void;
};

function orderFileBaseName(order: Order, dataFormatada: string): string {
  return `pedido_${formatOrderDisplayId(order.id)}_${order.importadoraName.replace(/\s+/g, '_')}_${dataFormatada.replace(/\//g, '-')}`;
}

function orderStatusLabel(status: Order['status']): string {
  if (status === 'faturado') return 'Faturado';
  if (status === 'aberto') return 'Em Aberto';
  return 'Cancelado';
}

function triggerDownload(blob: Blob, filename: string): void {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function orderExportStyles(): string {
  return `
    @page { margin: 20mm; }
    body {
      font-family: Arial, sans-serif;
      font-size: 11px;
      color: #000;
      position: relative;
    }
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-28deg);
      opacity: 0.1;
      z-index: 0;
      pointer-events: none;
      width: min(70vw, 420px);
    }
    .watermark img {
      width: 100%;
      height: auto;
      display: block;
    }
    .page-content {
      position: relative;
      z-index: 1;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #5B3DF5;
      padding-bottom: 10px;
    }
    .header h1 {
      color: #5B3DF5;
      margin: 0;
      font-size: 20px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 20px;
      padding: 15px;
      background: #f5f5f5;
      border-radius: 5px;
    }
    .info-item { margin-bottom: 8px; }
    .info-label { font-weight: bold; color: #555; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th {
      background: #5B3DF5;
      color: white;
      padding: 10px 8px;
      text-align: left;
      font-size: 10px;
    }
    td {
      border: 1px solid #ddd;
      padding: 8px;
      font-size: 10px;
    }
    tr:nth-child(even) { background: #f9f9f9; }
    .totals {
      margin-top: 20px;
      padding: 15px;
      background: #f5f5f5;
      border-radius: 5px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 12px;
    }
    .total-row.main {
      font-size: 16px;
      font-weight: bold;
      color: #5B3DF5;
      padding-top: 10px;
      border-top: 2px solid #5B3DF5;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
      font-size: 10px;
      color: #666;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .watermark {
        position: fixed;
        opacity: 0.12;
      }
    }
  `;
}

export function buildOrderExportHtml(order: Order, options: OrderExportOptions = {}): string {
  const hoje = new Date();
  const dataFormatada = hoje.toLocaleDateString('pt-BR');
  const horaFormatada = hoje.toLocaleTimeString('pt-BR');
  const clientName = options.client?.name ?? order.clienteName ?? 'Não informado';
  const transportadora = options.transportadora ?? null;

  let totalCaixas = 0;
  let totalIPI = 0;
  order.items.forEach((item) => {
    totalCaixas += item.quantity;
    totalIPI += getCartLineTotal(item) * 0.065;
  });

  const itemsRows = order.items
    .map((item) => {
      const vlrUnitario = formatPriceBRL(getUnitPrice(item.product));
      const vlrCaixa = formatPriceBRL(getBoxPrice(item.product));
      const lineTotal = getCartLineTotal(item);
      const vlrTotal = formatPriceBRL(lineTotal);
      const ipiValor = formatPriceBRL(lineTotal * 0.065);
      return `
        <tr>
          <td>${item.product.code}</td>
          <td>${item.product.name}</td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: right;">R$ ${vlrUnitario}</td>
          <td style="text-align: right;">R$ ${vlrCaixa}</td>
          <td style="text-align: right;">R$ ${vlrTotal}</td>
          <td style="text-align: center;">6,50%</td>
          <td style="text-align: right;">R$ ${ipiValor}</td>
        </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Pedido ${formatOrderDisplayId(order.id)}</title>
  <style>${orderExportStyles()}</style>
</head>
<body>
  <div class="watermark" aria-hidden="true">
    <img src="${IMPORTA_FLOW_LOGO_DATA_URL}" alt="">
  </div>
  <div class="page-content">
    <div class="header">
      <h1>${order.importadoraName}</h1>
      <p>Pedido Nº ${formatOrderDisplayId(order.id)} | Data: ${dataFormatada} ${horaFormatada}</p>
    </div>

    <div class="info-grid">
      <div>
        <div class="info-item">
          <span class="info-label">Cliente:</span> ${clientName}
        </div>
        <div class="info-item">
          <span class="info-label">Representante:</span> ${order.representanteName}
        </div>
        <div class="info-item">
          <span class="info-label">Data de Criação:</span> ${order.createdAt.toLocaleDateString('pt-BR')}
        </div>
        <div class="info-item">
          <span class="info-label">Status:</span> ${orderStatusLabel(order.status)}
        </div>
      </div>
      <div>
        <div class="info-item">
          <span class="info-label">Prazo de Pagamento:</span> ${order.paymentTerm || 'Não informado'}
        </div>
        <div class="info-item">
          <span class="info-label">Transportadora:</span> ${transportadora?.name || 'Não informada'}
        </div>
        ${
          transportadora
            ? `
        <div class="info-item">
          <span class="info-label">Telefone Transportadora:</span> ${transportadora.phone ?? ''}
        </div>
        <div class="info-item">
          <span class="info-label">Local:</span> ${transportadora.city ?? ''} - ${transportadora.state ?? ''}
        </div>
        `
            : ''
        }
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Descrição</th>
          <th style="text-align: center;">Cxs</th>
          <th style="text-align: right;">Vlr/Uni</th>
          <th style="text-align: right;">Vlr/Cx</th>
          <th style="text-align: right;">Vlr Total</th>
          <th style="text-align: center;">IPI %</th>
          <th style="text-align: right;">IPI</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>

    <div class="totals">
      <div class="total-row">
        <span>Total de Caixas:</span>
        <span>${totalCaixas}</span>
      </div>
      <div class="total-row">
        <span>Subtotal:</span>
        <span>R$ ${order.total.toFixed(2)}</span>
      </div>
      <div class="total-row">
        <span>Total IPI:</span>
        <span>R$ ${totalIPI.toFixed(2)}</span>
      </div>
      <div class="total-row main">
        <span>TOTAL DO PEDIDO:</span>
        <span>R$ ${order.total.toFixed(2)}</span>
      </div>
    </div>

    ${
      order.notes
        ? `
    <div class="footer">
      <div class="info-label">Observações:</div>
      <p>${order.notes}</p>
    </div>
    `
        : ''
    }

    <div class="footer" style="margin-top: 40px; text-align: center;">
      <p>Documento gerado em ${dataFormatada} às ${horaFormatada} · Importa Flow</p>
    </div>
  </div>
</body>
</html>`;
}

export function exportOrderToCSV(order: Order, options: OrderExportOptions = {}): void {
  const hoje = new Date();
  const dataFormatada = hoje.toLocaleDateString('pt-BR');
  const horaFormatada = hoje.toLocaleTimeString('pt-BR');
  const client = options.client;
  const transportadora = options.transportadora;

  let csvContent = '';
  csvContent += `${order.importadoraName}\n`;
  csvContent += `Data: ${dataFormatada},,,,,,,Pedido Nro. ${formatOrderDisplayId(order.id)}\n`;
  csvContent += `Hora: ${horaFormatada},,,,,,,Nota Nro.: ${order.notaFiscal || ''}\n`;
  csvContent += `\n`;
  csvContent += `Cliente:,${client?.name ?? order.clienteName ?? 'Não informado'},,,,Data Emissão:,${order.createdAt.toLocaleDateString('pt-BR')}\n`;
  csvContent += `Endereço:,${client?.address ?? ''},,,,Data Saída:,${order.updatedAt?.toLocaleDateString('pt-BR') || ''}\n`;
  csvContent += `Bairro:,${client?.cnpj ?? ''},,,,UF:,CEP:,\n`;
  csvContent += `CNPJ/CPF:,${client?.cnpj ?? ''},,Inscr. Est.:,\n`;
  csvContent += `Fone:,${client?.phone ?? ''},,Forma Pagto.:,${order.paymentTerm || ''}\n`;
  csvContent += `Contato:,${client?.email ?? ''},,Fax.:,\n`;
  csvContent += `E-Mail:,${client?.email ?? ''}\n`;
  csvContent += `\n`;
  csvContent += `Referência,Foto,NCM,Cod. Barra,Descrição,Cxs,Vlr/Uni,Vlr/Cx,Vlr Total,ST,IPI%,IPI\n`;

  let totalCaixas = 0;
  let totalIPI = 0;

  order.items.forEach((item) => {
    const vlrUnitario = formatPriceBRL(getUnitPrice(item.product));
    const vlrCaixa = formatPriceBRL(getBoxPrice(item.product));
    const lineTotal = getCartLineTotal(item);
    const vlrTotal = formatPriceBRL(lineTotal);
    const ipiPercentual = '6,50';
    const ipiValor = formatPriceBRL(lineTotal * 0.065);

    totalCaixas += item.quantity;
    totalIPI += parseFloat(ipiValor);

    csvContent += `${item.product.code},,,,${item.product.name},${item.quantity},${vlrUnitario},${vlrCaixa},${vlrTotal},0.00,${ipiPercentual},${ipiValor}\n`;
  });

  csvContent += `\n`;
  csvContent += `,,,,,VL Total:,${order.total.toFixed(2)}\n`;
  csvContent += `,,,,,Total ST:,0.00\n`;
  csvContent += `,,,,,Total IPI:,${totalIPI.toFixed(2)}\n`;
  csvContent += `\n`;
  csvContent += `Total de Caixas:,${totalCaixas}\n`;
  csvContent += `Total de Cubagem:,\n`;
  csvContent += `Vendedor:,${order.representanteName}\n`;
  csvContent += `Vendedor Ext.:,\n`;
  csvContent += `Frete:,\n`;
  csvContent += `Transportadora:,${transportadora?.name ?? ''}\n`;
  csvContent += `Fone:,${transportadora?.phone ?? ''}\n`;
  csvContent += `Total Peso Líquido:,\n`;
  csvContent += `Total Peso Bruto:,\n`;
  csvContent += `Observação:,${order.notes || ''}\n`;
  csvContent += `Gerado por:,Importa Flow\n`;

  triggerDownload(
    new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }),
    `${orderFileBaseName(order, dataFormatada)}.csv`
  );
  options.onSuccess?.('Pedido exportado para CSV com sucesso!');
}

export function exportOrderToPDF(order: Order, options: OrderExportOptions = {}): void {
  const dataFormatada = new Date().toLocaleDateString('pt-BR');
  const htmlContent = buildOrderExportHtml(order, options);

  triggerDownload(
    new Blob([htmlContent], { type: 'text/html' }),
    `${orderFileBaseName(order, dataFormatada)}.html`
  );

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }

  options.onSuccess?.('Pedido exportado para PDF com sucesso!');
}

export function handleOrderExport(
  order: Order,
  format: string,
  options: OrderExportOptions = {}
): void {
  if (format === 'csv') {
    exportOrderToCSV(order, options);
  } else if (format === 'pdf') {
    exportOrderToPDF(order, options);
  }
}
