Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    selectedRelease: null,
    items: [
    {
        xtype: 'container',
        itemId: 'releaseDropDown',
        columnWidth: 1
    },
    {
        xtype: 'container',
        itemId: 'chart',
        columnWidth: 1
    }    
    ],
    launch: function() {
        this.down("#releaseDropDown").add( {
            xtype: 'rallyreleasecombobox',
            itemId : 'releaseSelector',
            listeners: {
                    select: this._onReleaseSelect,
                    ready:  this._onReleaseSelect,
                    scope: this
            }
        });
    },

    _onReleaseSelect : function() {       
        var value =  this.down('#releaseSelector').getRecord();
        this.selectedRelease = value.data;
        
        Ext.create('Rally.data.WsapiDataStore', {
            model: "Release",
            autoLoad : true,
            fetch: ["ObjectID","Name","ReleaseStartDate","ReleaseDate","Project"],
            filters: [
                {
                    property: 'Name',
                    value: value.data.Name
                }
            ],
            listeners: {
                scope : this,
                load : this._onReleases
            }
        });
    },

    _onReleases : function(store, data, success) {
        var that = this;
        var releaseIds = _.map(data, function(d) { return d.data.ObjectID; });
        that.selectedReleaseIds = releaseIds;
        Ext.create('Rally.data.lookback.SnapshotStore', {
            autoLoad : true,
            listeners: {
                load: this._onReleaseSnapShotData,
                scope : this
            },
            fetch: ['ObjectID','Name', 'Priority','State', '_ValidFrom','_ValidTo'],
            hydrate: ['State'],
            filters: [
                {
                    property: '_TypeHierarchy',
                    operator: 'in',
                    value: ['Defect']
                },
                {
                    property: 'Release',
                    operator: 'in',
                    value: releaseIds
                }
            ]
        });        
    }, 
    _onReleaseSnapShotData : function(store,data,success) {
        var lumenize = window.parent.Rally.data.lookback.Lumenize;
        var snapShotData = _.map(data,function(d){return d.data});      
        var openValues = ['Submitted','Open'];
        var closedValues = ['Closed','Fixed'];

        var holidays = [
            {year: 2014, month: 1, day: 1} 
        ];

        var metrics = [
            {as: 'DefectOpenCount',     f: 'filteredCount', filterField: 'State', filterValues: openValues},
            {as: 'DefectClosedCount',   f: 'filteredCount', filterField: 'State', filterValues: closedValues},
        ];

        var summaryMetricsConfig = [
        ];
        
        var derivedFieldsAfterSummary = [
            {   as: 'Cumulative', 
                f : function (row,index,summaryMetrics, seriesData) {
                    return 0;
                }
            }
        ];
        var deriveFieldsOnInput = [
            {as: 'HighPriority', f: function(row) { return row["Priority"] === "High"; } }
        ];
        
        var config = {
          deriveFieldsOnInput: deriveFieldsOnInput,
          metrics: metrics,
          summaryMetricsConfig: summaryMetricsConfig,
          deriveFieldsAfterSummary: derivedFieldsAfterSummary,
          granularity: lumenize.Time.MONTH,
          tz: 'America/Denver',
          holidays: holidays,
          workDays: 'Monday,Tuesday,Wednesday,Thursday,Friday'
        };
        
        var startOnISOString = new lumenize.Time(this.selectedRelease.ReleaseStartDate).getISOStringInTZ(config.tz);
        var upToDateISOString = new lumenize.Time(this.selectedRelease.ReleaseDate).getISOStringInTZ(config.tz);
        
        var calculator = new lumenize.TimeSeriesCalculator(config);
        calculator.addSnapshots(snapShotData, startOnISOString, upToDateISOString);

        var hcConfig = [{ name: "label" }, { name : "DefectOpenCount" }, { name : "DefectClosedCount"}];
        var hc = lumenize.arrayOfMaps_To_HighChartsSeries(calculator.getResults().seriesData, hcConfig);
        
        this._showChart(hc);
        
    },
    _showChart : function(series) {
        
        var chart = this.down("#chart");
        chart.removeAll();

        series[1].data = _.map(series[1].data, function(d) { return _.isNull(d) ? 0 : d; });
        
        var extChart = Ext.create('Rally.ui.chart.Chart', {
            width: 800,
            height: 500,
         chartData: {
            categories : series[0].data,
            series : [
                series[1],
                series[2]
            ]
         },
          chartConfig : {
                chart: {
                },
                title: {
                text: 'Release Defect Trend',
                },                        
                xAxis: {
                    tickInterval : 1
                },
                yAxis: {
                    title: {
                        text: 'Count'
                    },
                    plotLines: [{
                        value: 0,
                        width: 1,
                        color: '#808080'
                    }]
                },
                tooltip: {
                    valueSuffix: ' Defects'
                },
                legend: {
                            align: 'center',
                            verticalAlign: 'bottom'
                }
            }
        });
        chart.add(extChart);
        var p = Ext.get(chart.id);
        var elems = p.query("div.x-mask");
        _.each(elems, function(e) { e.remove(); });
        var elems = p.query("div.x-mask-msg");
        _.each(elems, function(e) { e.remove(); });
    }            
});