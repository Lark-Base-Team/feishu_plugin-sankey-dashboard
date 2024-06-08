import './App.css';
import {
    DashboardState,
    IDataRange,
    AllDataRange,
    DATA_SOURCE_SORT_TYPE,
    GroupMode, ORDER,
    SourceType,
    bitable, dashboard,
    ICategory, IConfig, IData,
    FieldType, ISeries, Rollup,
    IDataCondition,
} from "@lark-base-open/js-sdk";
import {
    Button, DatePicker,
    ConfigProvider, Checkbox,
    Row, Col, GetProp,
    ColorPicker, Form, InputNumber,
    FormInstance, Select
} from 'antd';
import { Sankey, G2, Datum } from "@antv/g2plot";
import {
    Form as SemiForm,
    Select as SemiSelect,
    Switch as SemiSwitch
} from '@douyinfe/semi-ui';
import { useState, useEffect, useRef, useCallback } from 'react';
import { getTime } from './utils';
import dayjs from 'dayjs';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import classnames from 'classnames'

interface ICountDownConfig {
    color: string;
    target: number;
    units: string[];
    othersConfig: string[],
}

const othersConfigKey = [{
    key: 'showTitle',
    title: '展示标题',
}]

const defaultOthersConfig = ['showTitle']

import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en';

dayjs.locale('zh-cn');

const availableUnits: { [p: string]: { title: string, unit: number, order: number } } = {
    sec: {
        title: '秒',
        unit: 1,
        order: 1,
    },
    min: {
        title: '分',
        unit: 60,
        order: 2,
    },
    hour: {
        title: '小时',
        unit: 60 * 60,
        order: 3,
    },
    day: {
        title: '天',
        unit: 60 * 60 * 24,
        order: 4,
    },
    week: {
        title: '周',
        unit: 60 * 60 * 24 * 7,
        order: 5,
    },
    month: {
        title: '月',
        unit: 60 * 60 * 24 * 30,
        order: 6,
    },
}

interface ITableSource {
    tableId: string;
    tableName: string;
}

export default function App() {
    const [chartError, setchartError] = useState<boolean>(false);
    const chartContainerRef = useRef(null);
    const chartComponent = async (
        data: any[],
        nodeAlign = 'right', //布局方向
        nodeWidth = 0.03, //节点宽度
        nodePaddingRatio = 0.03,//节点垂直间距
        linkOpacity = 0.8,//连接透明度
        nodeOpacity = 1,//节点透明度
        textSize = 15,//标签字体大小
        textWeight = 'normal',//标签字体粗细
        textColor = '#545454',//标签字体颜色
        theme = {
            colors20: [
                '#FF5733',
                '#C70039',
                '#900C3F',
                '#581845',
                '#1B4F72',
                '#2E86C1',
                '#AED6F1',
                '#A569BD',
                '#196F3D',
                '#F1C40F',
                '#FFC300',
                '#DAF7A6',
                '#FFC0CB',
                '#808000',
                '#0000FF',
                '#008080',
                '#800080',
                '#FFA500',
                '#00FFFF',
                '#FF00FF']
        },
        showNodeValue = false,
    ) => {
        const oldChart = chartContainerRef.current.chart;
        if (oldChart) {
            oldChart.destroy();
        }

        const { registerTheme } = G2;
        console.log(theme);
        registerTheme('defaultTheme', theme);
        const plot = new Sankey(chartContainerRef.current, {
            data: data,
            sourceField: 'source',
            targetField: 'target',
            weightField: 'value',
            padding: 10,
            edgeStyle: {
                fillOpacity: linkOpacity,
            },
            nodeStyle: {
                opacity: nodeOpacity,
            },
            rawFields: ['path', 'value'],
            label: {
                fields: ['x', 'name', 'path', 'value'],
                formatter: (datum: Datum) => {
                    if (showNodeValue) {
                        return `${datum.name}\n${datum.value}`;
                    } else {
                        return datum.name;
                    }
                },
                callback: (x: number[]) => {
                    const isLast = x[1] === 1;// 最后一列靠边的节点
                    //console.log(x)
                    return {
                        style: {
                            fill: textColor,
                            textAlign: isLast ? 'end' : 'start',
                            fontSize: textSize,
                            fontWeight: textWeight as "normal" | "bolder" | "lighter",
                        },
                        offsetX: isLast ? -8 : 8,
                    };
                },
                layout: [{ type: 'hide-overlap' }],
            },

            //节点降序排序
            //nodeSort: (a, b) => b.value - a.value,
            nodeWidthRatio: nodeWidth,
            nodeAlign: nodeAlign as "left" | "right" | "center" | "justify",
            nodePaddingRatio: nodePaddingRatio,
            nodeDraggable: true,
            tooltip: {
                fields: ['path', 'value'],
                formatter: ({ path, value }) => {
                    return {
                        name: path,
                        value: value,
                    };
                },
            },
        });
        plot.update({ theme: 'defaultTheme' })
        plot.render();

        plot.on("element:mouseenter", (event) => {
            const node = event.data.data;
            if (!node.isNode) return;
            plot.setState("active", (data: any) => {
                const { isNode, source, target, name } = data;
                if (!isNode) {
                    if ([source, target].includes(node.name)) return true;
                } else if (name == node.name) return true;

                return false;
            });
        });

        plot.on("element:mouseout", (event) => {
            const elements = event.view.views[0].geometries[0].elements;
            elements.forEach((edge: any) => edge?.setState("active", false));
        });

        chartContainerRef.current.chart = plot;

    }

    const [tableSource, setTableSource] = useState<ITableSource[]>([]);
    const [dataRange, setDataRange] = useState<IDataRange[]>([{ type: SourceType.ALL }]);
    const [categories, setCategories] = useState<ICategory[]>([]);
    const [locale, setLocale] = useState(zhCN);

    const getTableList = useCallback(async () => {
        const tables = await bitable.base.getTableList();
        return await Promise.all(tables.map(async table => {
            const name = await table.getName();
            return {
                tableId: table.id,
                tableName: name
            }
        }))
    }, [])
    const getTableRange = useCallback((tableId: string) => {
        return dashboard.getTableDataRange(tableId);
    }, [])
    const getCategories = useCallback((tableId: string) => {
        return dashboard.getCategories(tableId);
    }, [])

    const [config, setConfig] = useState({
        tableId: '',
        source_col: null,
        value_col: null,
        target_col: null,
    });

    useEffect(() => {
        async function init() {
            const tableList = await getTableList();
            setTableSource(tableList);
            if (dashboard.state === DashboardState.Create) {
                // creating state
                const tableId = tableList[0]?.tableId;
                const [tableRanges, categories] = await Promise.all([getTableRange(tableId), getCategories(tableId)]);

                //console.log(tableRanges, categories)

                setDataRange(tableRanges);
                setCategories(categories);

                setConfig((prevConfig) => ({
                    ...prevConfig,
                    tableId: tableList[0]?.tableId,
                }))

            } else {
                // setting & view state
                const dashboardConfig = await dashboard.getConfig();
                const prevConfig = dashboardConfig.customConfig;
                console.log('init().else setting & view state run')
                let { tableId, source_col, value_col, target_col } = prevConfig as any
                const [tableRanges, categories] = await Promise.all([getTableRange(tableId), getCategories(tableId)]);
                setDataRange(tableRanges);
                setCategories(categories);
                if (config.tableId.length === 0) {
                    setConfig(prevConfig as any)
                }
            }
        }
        init();

    }, [getTableList, getTableRange, getCategories])


    const url = new URL(window.location.href);

    const isCreate = dashboard.state === DashboardState.Create
    /** 是否配置模式下 */
    const isConfig = dashboard.state === DashboardState.Config || isCreate;

    const changeLang = (lang: 'en-us' | 'zh-cn') => {
        if (lang === 'zh-cn') {
            setLocale(zhCN);
            dayjs.locale('zh-cn');
        } else {
            setLocale(enUS);
            dayjs.locale('en-ud');
        }
    }
    /*
    const updateConfig = (res: any) => {
        const { customConfig } = res;
        if (customConfig) {
            setConfig(customConfig as any)
            setTimeout(() => {
                // 预留3s给浏览器进行渲染，3s后告知服务端可以进行截图了
                dashboard.setRendered();
            }, 3000);
        }
    }

    useEffect(() => {
        if (isCreate) {
            return
        }
        // 初始化获取配置
        dashboard.getConfig().then(updateConfig);
    }, []);
    // 展示态
    useEffect(() => {
        if (dashboard.state === DashboardState.View) {
            dashboard.getData().then(data => {
                console.log('getdata', data)
            });

            dashboard.onDataChange(async (res) => {
                console.log('ondatachange', res)
            })
        }
    }, [])
    */

    useEffect(() => {
        const offConfigChange = dashboard.onConfigChange((r) => {
            // 监听配置变化，协同修改配置
            setConfig(r.data.customConfig as any);
        });
        return () => {
            offConfigChange();
        }
    }, []);

    useEffect(() => {
        console.log('5174 Config updated:', config);
    }, [config]);

    useEffect(() => {
        const a = async () => {
            const tableId = config.tableId;
            const [tableRanges, categories] = await Promise.all([getTableRange(tableId), getCategories(tableId)]);
            setDataRange(tableRanges);
            setCategories(categories);
            /*setConfig({
                ...config,
                source_col: null,
                value_col: null,
                target_col: null
            })*/
        }
        a();
    }, [config.tableId]);

    useEffect(() => {
        const findNameById = (data: any, id: string): string | undefined => {
            const item = data.find((item: { id: string; }) => item.id === id);
            return item ? item.name : undefined;
        };

        const calcuChartData_drawChart = async () => {
            const table = await bitable.base.getTableById(config.tableId);
            const fieldMetaList = await table.getFieldMetaList();
            const recordIdList = await table.getRecordIdList();

            const rename_dic = {
                'source_index': findNameById(fieldMetaList, config.source_col as any),
                'target_index': findNameById(fieldMetaList, config.target_col as any),
                'value_index': findNameById(fieldMetaList, config.value_col as any),
            };
            const origin_data = [];
            for (let i = 0; i < recordIdList.length; i++) {
                const recordData = {};
                for (let a = 0; a < fieldMetaList.length; a++) {
                    const cellString = await table.getCellString(fieldMetaList[a]?.id!, recordIdList[i]!);
                    recordData[fieldMetaList[a]?.name] = cellString;
                }
                origin_data.push(recordData);
            }
            const s_i = rename_dic['source_index'];
            const t_i = rename_dic['target_index'];
            const v_i = rename_dic['value_index'];
            const chartData = [];
            for (const entry of origin_data) {
                let new_entry = {
                    'source': entry[s_i],
                    'target': entry[t_i],
                    'value': entry[v_i],
                    'path': `${entry[s_i]} -> ${entry[t_i]} -> ${entry[v_i]}`
                }
                chartData.push(new_entry);
            }
            chartData.forEach((item, index) => {
                item.value = parseFloat(item.value);
            });

            console.log(chartData);

            if (chartContainerRef.current) {
                try {
                    await chartComponent(
                        chartData,
                        //nodeAlign,
                        //nodeWidth / 1000,
                        //nodePaddingRatio / 1000,
                        //linkOpacity / 100,
                        //nodeOpacity / 100,
                        //textSize,
                        //textWeight,
                        //textColor,
                        //themeData[selectedTheme],
                        //showNodeValue,
                    );
                } catch (error) {
                    console.error(error);
                    setchartError(true);
                }
            }
        }
        if (config.tableId.length !== 0 && config.source_col && config.target_col && config.value_col) {
            calcuChartData_drawChart();
        }
    }, [config])


    const onClick = () => {
        dashboard.saveConfig({
            customConfig: config,
            dataConditions: [],
        } as any)
    };
    const onRestClick = () => {
        dashboard.saveConfig({
            customConfig: {
                tableId: tableSource[0]?.tableId,
                source_col: null,
                value_col: null,
                target_col: null,
            },
            dataConditions: [],
        } as any);
        setConfig({
            tableId: tableSource[0]?.tableId,
            source_col: null,
            value_col: null,
            target_col: null,
        })
    };
    const renderConfig = () => {
        return Object.entries(config).map(([key, value]) => (
            <div key={key}>
                <strong>{key}:</strong> {value !== null ? value : 'null'}
            </div>
        ));
    };


    return (
        <main className={classnames({
            'main-config': isConfig,
            'main': true,
        })}>

            <ConfigProvider locale={locale}>

                <div className='content' style={{ position: 'relative' }}>
                    <div style={{ position: "absolute" }}>config: <br />{renderConfig()}</div>
                    <div ref={chartContainerRef} style={{ position: 'absolute' }}></div>
                </div>

                {isConfig || isCreate ? (
                    <div className='config-panel'>
                        {config?.tableId && (
                                <Form
                                    name="basic"
                                    labelCol={{ span: 7 }}
                                    wrapperCol={{ span: 16 }}
                                    style={{ width: '100%' }}
                                    initialValues={config}
                                    onValuesChange={async (changedVal, allValues) => {
                                        const key = Object.keys(changedVal)[0];
                                        const val = changedVal[key];
                                        setConfig((prevConfig) => ({
                                            ...prevConfig,
                                            [key]: val,
                                        }))
                                    }}
                                >
                                    <Form.Item
                                        name="tableId"
                                        label="选择数据表"
                                    >
                                        <Select
                                            style={{ width: 200 }}
                                            options={tableSource.map(source => ({
                                                value: source.tableId,
                                                label: source.tableName
                                            }))}
                                        />
                                    </Form.Item>
                                    <Form.Item
                                        name="source_col"
                                        label="选择起点列"
                                    >
                                        <Select
                                            placeholder='选择桑基图流量起点列'
                                            style={{ width: 200 }}
                                            options={categories.map(source => ({
                                                value: source.fieldId,
                                                label: source.fieldName
                                            }))}
                                        />
                                    </Form.Item>
                                    <Form.Item
                                        name="target_col"
                                        label="选择终点列"
                                    >
                                        <Select
                                            placeholder='选择桑基图流量终点列'
                                            style={{ width: 200 }}
                                            options={categories.map(source => ({
                                                value: source.fieldId,
                                                label: source.fieldName
                                            }))}
                                        />
                                    </Form.Item>
                                    <Form.Item
                                        name="value_col"
                                        label="选择数值列"
                                    >
                                        <Select
                                            placeholder='数值控制连接流量大小'
                                            style={{ width: 200 }}
                                            options={categories.map(source => ({
                                                value: source.fieldId,
                                                label: source.fieldName
                                            }))}
                                        />
                                    </Form.Item>
                                </Form>
                        )}
                        <div>
                            <Button
                                className='btn'
                                size="middle"
                                type="primary"
                                autoInsertSpace={false}
                                onClick={onClick}
                            >
                                确定
                            </Button>
                            <Button
                                className='btn'
                                size="middle"
                                type="primary"
                                autoInsertSpace={false}
                                onClick={onRestClick}
                            >
                                reset config
                            </Button>
                        </div>

                    </div>
                ) : null}
            </ConfigProvider>

        </main>
    )
}




