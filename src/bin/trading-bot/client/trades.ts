import {Component, EventEmitter, Input, Output, OnInit} from '@angular/core';
import {Module, ClientSideRowModelModule, GridOptions, ColDef, RowNode} from '@ag-grid-community/all-modules';

import * as Models from '../../../www/ts/models';
import * as Socket from '../../../www/ts/socket';
import * as Shared from '../../../www/ts/shared';

@Component({
  selector: 'trade-list',
  template: `<ag-grid-angular #tradeList class="ag-theme-fresh ag-theme-dark" style="height: 479px;width: 99.80%;" rowHeight="21" [gridOptions]="gridOptions" [modules]="modules" (cellClicked)="onCellClicked($event)"></ag-grid-angular>`
})
export class TradesComponent implements OnInit {

  private modules: Module[] = [ClientSideRowModelModule];

  private gridOptions: GridOptions = <GridOptions>{};

  private fireCxl: Socket.IFire<object>;

  public audio: boolean;

  public hasPongs: boolean;

  public headerNameMod: string = "";

  private sortTimeout: number;

  @Input() product: Models.ProductAdvertisement;

  @Input() set setQuotingParameters(o: Models.QuotingParameters) {
    this.audio = o.audio;
    if (!this.gridOptions.api) return;
    this.hasPongs = (o.safety === Models.QuotingSafety.Boomerang || o.safety === Models.QuotingSafety.AK47);
    this.headerNameMod = this.hasPongs ? "⇁" : "";
    this.gridOptions.columnDefs.map((r: ColDef) => {
      if (['Ktime','Kqty','Kprice','Kvalue','delta'].indexOf(r.field) > -1)
        this.gridOptions.columnApi.setColumnVisible(r.field, this.hasPongs);
      return r;
    });
    this.gridOptions.api.refreshHeader();
    this.emitLengths();
  }

  @Input() set setTrade(o: Models.Trade) {
    if (o === null) {
      if (this.gridOptions.rowData)
        this.gridOptions.api.setRowData([]);
    }
    else this.addRowData(o);
  }

  @Output() onTradesLength = new EventEmitter<number>();

  @Output() onTradesMatchedLength = new EventEmitter<number>();

  @Output() onTradesChartData = new EventEmitter<Models.TradeChart>();

  ngOnInit() {
    this.gridOptions.rowData = [];
    this.gridOptions.defaultColDef = { sortable: true, resizable: true };
    this.gridOptions.columnDefs = this.createColumnDefs();
    this.gridOptions.overlayNoRowsTemplate = `<span class="ag-overlay-no-rows-center">empty history of trades</span>`;

    this.fireCxl = new Socket.Fire(Models.Topics.CleanTrade);
  }

  private createColumnDefs = (): ColDef[] => {
    return [
      {width: 30, suppressSizeToFit: true, field: "cancel", headerName: 'cxl', cellRenderer: (params) => {
        return '<button type="button" class="btn btn-danger btn-xs"><span data-action-type="remove" style="font-size: 16px;font-weight: bold;padding: 0px;line-height: 12px;">&times;</span></button>';
      } },
      {width: 95, suppressSizeToFit: true, field:'time', headerValueGetter:(params) => { return this.headerNameMod + 'time'; }, cellRenderer:(params) => {
        var d = new Date(params.value||0);
        return (d.getDate()+'').padStart(2, "0")+'/'+((d.getMonth()+1)+'').padStart(2, "0")+' '+(d.getHours()+'').padStart(2, "0")+':'+(d.getMinutes()+'').padStart(2, "0")+':'+(d.getSeconds()+'').padStart(2, "0");
      }, cellClass: 'fs11px', sort: 'desc', comparator: (valueA: any, valueB: any, nodeA: RowNode, nodeB: RowNode, isInverted: boolean) => {
          return (nodeA.data.Ktime||nodeA.data.time) - (nodeB.data.Ktime||nodeB.data.time);
      }},
      {width: 95, suppressSizeToFit: true, field:'Ktime', hide:true, headerName:'⇋time', cellRenderer:(params) => {
        if (params.value==0) return '';
        var d = new Date(params.value);
        return (d.getDate()+'').padStart(2, "0")+'/'+((d.getMonth()+1)+'').padStart(2, "0")+' '+(d.getHours()+'').padStart(2, "0")+':'+(d.getMinutes()+'').padStart(2, "0")+':'+(d.getSeconds()+'').padStart(2, "0");
      }, cellClass: 'fs11px' },
      {width: 40, suppressSizeToFit: true, field:'side', headerName:'side', cellRenderer:(params) => {
        return params.value === '&lrhar;' ? '<span style="font-size:15px;padding-left:3px;">' + params.value + '</span>' : params.value;
      },cellClass: (params) => {
        if (params.value === 'Bid') return 'buy';
        else if (params.value === 'Ask') return "sell";
        else if (params.value === '&lrhar;') return "kira";
        else return "unknown";
      }},
      {width: 80, field:'price', headerValueGetter:(params) => { return this.headerNameMod + 'price'; }, cellClass: (params) => {
        return params.data.pingSide;
      }, cellRendererFramework: Shared.QuoteCurrencyCellComponent},
      {width: 85, suppressSizeToFit: true, field:'quantity', headerValueGetter:(params) => { return this.headerNameMod + 'qty'; }, cellClass: (params) => {
        return params.data.pingSide;
      }, cellRendererFramework: Shared.BaseCurrencyCellComponent},
      {width: 69, field:'value', headerValueGetter:(params) => { return this.headerNameMod + 'value'; }, cellClass: (params) => {
        return params.data.pingSide;
      }, cellRendererFramework: Shared.QuoteCurrencyCellComponent},
      {width: 75, field:'Kvalue', headerName:'⇋value', hide:true, cellClass: (params) => {
        return params.data.pongSide;
      }, cellRendererFramework: Shared.QuoteCurrencyCellComponent},
      {width: 85, suppressSizeToFit: true, field:'Kqty', headerName:'⇋qty', hide:true, cellClass: (params) => {
        return params.data.pongSide;
      }, cellRendererFramework: Shared.BaseCurrencyCellComponent},
      {width: 80, field:'Kprice', headerName:'⇋price', hide:true, cellClass: (params) => {
        return params.data.pongSide;
      }, cellRendererFramework: Shared.QuoteCurrencyCellComponent},
      {width: 65, field:'delta', headerName:'delta', hide:true, cellClass: (params) => {
        if (params.data.side === '&lrhar;') return "kira"; else return "";
      }, cellRenderer: (params) => {
        return (!params.value) ? "" : params.data.quoteSymbol + parseFloat(params.value.toFixed(8));
      }}
    ];
  }

  public onCellClicked = ($event) => {
    if ($event.event.target.getAttribute("data-action-type")!='remove') return;
    this.fireCxl.fire({
      tradeId: $event.data.tradeId
    });
  }

  private addRowData = (t: Models.Trade) => {
    if (!this.gridOptions.api || this.product.base == null) return;
    if (t.Kqty<0) {
      this.gridOptions.api.forEachNode((node: RowNode) => {
        if (node.data.tradeId==t.tradeId)
          this.gridOptions.api.applyTransaction({remove:[node.data]});
      });
    } else {
      let exists: boolean = false;
      this.gridOptions.api.forEachNode((node: RowNode) => {
        if (!exists && node.data.tradeId==t.tradeId) {
          exists = true;
          if (t.Ktime && <any>t.Ktime=='Invalid date') t.Ktime = null;
          node.setData(Object.assign(node.data, {
            time: t.time,
            quantity: t.quantity,
            value: t.value,
            Ktime: t.Ktime || 0,
            Kqty: t.Kqty ? t.Kqty : null,
            Kprice: t.Kprice ? t.Kprice : null,
            Kvalue: t.Kvalue ? t.Kvalue : null,
            delta: t.delta?t.delta:null,
            side: t.Kqty >= t.quantity ? '&lrhar;' : (t.side === Models.Side.Ask ? "Ask" : "Bid"),
            pingSide: t.side == Models.Side.Ask ? "sell" : "buy",
            pongSide: t.side == Models.Side.Ask ? "buy" : "sell"
          }));
          if (t.loadedFromDB === false) {
            if (this.sortTimeout) window.clearTimeout(this.sortTimeout);
            this.sortTimeout = window.setTimeout(() => {
              this.gridOptions.api.setSortModel([{colId: 'time', sort: 'desc'}]);
              setTimeout(()=>{try{this.gridOptions.api.redrawRows();}catch(e){}},0);
            }, 269);
          }
        }
      });
      if (!exists) {
        if (t.Ktime && <any>t.Ktime=='Invalid date') t.Ktime = null;
        this.gridOptions.api.applyTransaction({add:[{
          tradeId: t.tradeId,
          time: t.time,
          price: t.price,
          quantity: t.quantity,
          side: t.Kqty >= t.quantity ? '&lrhar;' : (t.side === Models.Side.Ask ? "Ask" : "Bid"),
          pingSide: t.side == Models.Side.Ask ? "sell" : "buy",
          pongSide: t.side == Models.Side.Ask ? "buy" : "sell",
          value: t.value,
          Ktime: t.Ktime || 0,
          Kqty: t.Kqty ? t.Kqty : null,
          Kprice: t.Kprice ? t.Kprice : null,
          Kvalue: t.Kvalue ? t.Kvalue : null,
          delta: t.delta && t.delta!=0 ? t.delta : null,
          quoteSymbol: this.product.quote.replace('EUR','€').replace('USD','$'),
          productFixedPrice: this.product.tickPrice,
          productFixedSize: this.product.tickSize
        }]});
      }
      if (t.loadedFromDB === false) {
        if (this.audio) {
          var audio = new Audio('audio/'+(t.isPong?'1':'0')+'.mp3');
          audio.volume = 0.5;
          audio.play();
        }
        this.onTradesChartData.emit(new Models.TradeChart(
          (t.isPong && t.Kprice)?t.Kprice:t.price,
          (t.isPong && t.Kprice)?(t.side === Models.Side.Ask ? Models.Side.Bid : Models.Side.Ask):t.side,
          (t.isPong && t.Kprice)?t.Kqty:t.quantity,
          (t.isPong && t.Kprice)?t.Kvalue:t.value,
          t.isPong
        ));
      }
    }

    this.gridOptions.api.sizeColumnsToFit();
    this.emitLengths();
  }

  private emitLengths = () => {
    this.onTradesLength.emit(this.gridOptions.api.getModel().getRowCount());
    var tradesMatched: number = 0;
    if (this.hasPongs) {
      this.gridOptions.api.forEachNode((node: RowNode) => {
        if (node.data.Kqty) tradesMatched++;
      });
    } else tradesMatched = -1;
    this.onTradesMatchedLength.emit(tradesMatched);
  }
}
