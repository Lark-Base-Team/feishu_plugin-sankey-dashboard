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
    Button, ColorPicker,
    ConfigProvider,
    Row, Col, GetProp
} from 'antd';
import { Sankey, G2, Datum } from "@antv/g2plot";
import {
    Form, Tag, Checkbox,
    Select, Switch,
    Divider, InputNumber
} from '@douyinfe/semi-ui';
import { } from '@douyinfe/semi-icons';
import { useState, useEffect, useRef, useCallback } from 'react';
import { getTime } from './utils';
import dayjs from 'dayjs';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import classnames from 'classnames'


const othersConfigKey = [{
    key: 'showTitle',
    title: '展示标题',
}]

const defaultOthersConfig = ['showTitle']

import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en';

dayjs.locale('zh-cn');


interface ITableSource {
    tableId: string;
    tableName: string;
}

export default function App() {
    const [chartError, setchartError] = useState<boolean>(false);
    const chartContainerRef = useRef(null);
    const chartComponent = async (
        data: any[],
        { nodeAlign = 'right', //布局方向
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
            showNodeValue = false // 是否显示节点值
        } = {}
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
        selectedTheme: 0,
        nodeWidth: 20,
        nodePaddingRatio: 80,
        nodeOpacity: 100,
        linkOpacity: 80,
        textSize: 15,
        textWeight: 'normal',
        nodeAlign: 'right',
        textColor: '#000000',
        showNodeValue: false,
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
                        {
                            nodeAlign: config.nodeAlign,
                            nodeWidth: config.nodeWidth / 1000,
                            nodePaddingRatio: config.nodePaddingRatio / 1000,
                            linkOpacity: config.linkOpacity / 100,
                            nodeOpacity: config.nodeOpacity / 100,
                            textSize: config.textSize,
                            textWeight: config.textWeight,
                            textColor: config.textColor,
                            //theme:themeData[config.selectedTheme],
                            showNodeValue: config.showNodeValue
                        }
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
                selectedTheme: 0,
                nodeWidth: 15,
                nodePaddingRatio: 80,
                nodeOpacity: 100,
                linkOpacity: 80,
                textSize: 15,
                textWeight: 'normal',
                nodeAlign: 'right',
                textColor: '#000000',
                showNodeValue: false,
            },
            dataConditions: [],
        } as any);
        setConfig({
            tableId: tableSource[0]?.tableId,
            source_col: null,
            value_col: null,
            target_col: null,
            selectedTheme: 0,
            nodeWidth: 15,
            nodePaddingRatio: 80,
            nodeOpacity: 100,
            linkOpacity: 80,
            textSize: 15,
            textWeight: 'normal',
            nodeAlign: 'right',
            textColor: '#000000',
            showNodeValue: false,
        })
    };
    const renderConfig = () => {
        return Object.entries(config).map(([key, value]) => (
            <div key={key}>
                <strong>{key}:</strong> {value !== null ? value : 'null'}
            </div>
        ));
    };
    const renderCustomOption_tableSVG = (item: any) => {
        return (
            <Select.Option
                value={item.tableId}
                showTick={false}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src='./src/Field_icon/table.svg' />
                    {item.tableName}
                </div>
            </Select.Option>
        )
    };
    const renderCustomOption_col = (item: any) => {
        let iconPath = ''
        switch (item.fieldType) {
            case FieldType.NotSupport:
                iconPath = '';
                break;
            case FieldType.Text:
                iconPath = './src/Field_icon/text.svg'; // 设置多行文本图标路径
                break;
            case FieldType.Number:
                iconPath = './src/Field_icon/number.svg'; // 设置数字图标路径
                break;
            case FieldType.SingleSelect:
                iconPath = ''; // 设置单选图标路径
                break;
            case FieldType.MultiSelect:
                iconPath = ''; // 设置多选图标路径
                break;
            case FieldType.DateTime:
                iconPath = './src/Field_icon/date.svg'; // 设置日期图标路径
                break;
            case FieldType.Checkbox:
                iconPath = ''; // 设置复选框图标路径
                break;
            case FieldType.User:
                iconPath = './src/Field_icon/person.svg'; // 设置人员图标路径
                break;
            case FieldType.Phone:
                iconPath = './src/Field_icon/phoneNumber.svg'; // 设置电话图标路径
                break;
            case FieldType.Url:
                iconPath = './src/Field_icon/URL.svg'; // 设置超链接图标路径
                break;
            case FieldType.Email:
                iconPath = './src/Field_icon/Email.svg'; // 设置電子郵件图标路径
                break;
            default:
                iconPath = ''; // 默认图标路径或处理
                break;
        }
        return (
            <Select.Option
                value={item.fieldId}
                showTick={false}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src={iconPath} />
                    {item.fieldName}
                </div>

            </Select.Option>
        )
    }


    return (
        <main className={classnames({
            'main-config': isConfig,
            'main': true,
        })}>

            <ConfigProvider locale={locale}>

                <div className='content' style={{ position: 'relative' }}>
                    <div ref={chartContainerRef} style={{ position: 'absolute', width: '90%', height: '90%' }}></div>
                    <div style={{ position: "absolute" }}>config: <br />{renderConfig()}</div>
                </div>

                {isConfig || isCreate ? (
                    <div className='config-panel'
                        style={{
                            overflowY: 'scroll', // 仅纵向滚动
                            overflowX: 'hidden', // 禁止横向滚动
                            paddingLeft: '15px',
                        }}>
                        {config?.tableId && (
                            <Form
                                layout='vertical'
                                style={{ width: 300 }}
                                onValueChange={(values, changedField) => {
                                    console.log(values, changedField)
                                    const key = Object.keys(changedField)[0];
                                    const val = changedField[key];
                                    setConfig((prevConfig) => ({
                                        ...prevConfig,
                                        [key]: val,
                                    }))
                                }}
                            >
                                <Form.Select
                                    field='tableId'
                                    label={{ text: '数据源' }}
                                    initValue={config.tableId}
                                    style={{ width: '100%', display: 'flex' }}
                                >
                                    {tableSource.map(source => renderCustomOption_tableSVG(source))}
                                </Form.Select>
                                <Form.Select
                                    field='dataRange'
                                    label={{ text: '数据范围' }}
                                    placeholder='not support yet'
                                    style={{ width: '100%' }}
                                >
                                </Form.Select>

                                <Divider margin='12px'></Divider>

                                <Form.Select
                                    field='source_col'
                                    label={{ text: '起点列' }}
                                    placeholder='选择起点数据'
                                    initValue={config.source_col}
                                    style={{ width: '100%' }}
                                >
                                    {categories.map(source => renderCustomOption_col(source))}
                                </Form.Select>
                                <Form.Select
                                    field='target_col'
                                    label={{ text: '终点列' }}
                                    placeholder='选择终点数据'
                                    initValue={config.target_col}
                                    style={{ width: '100%' }}
                                >
                                    {categories.map(source => renderCustomOption_col(source))}
                                </Form.Select>
                                <Form.Select
                                    field='value_col'
                                    label={{ text: '数值列' }}
                                    placeholder='控制连接流量大小'
                                    initValue={config.value_col}
                                    style={{ width: '100%' }}
                                >
                                    {categories.map(source => renderCustomOption_col(source))}
                                </Form.Select>

                                <Divider margin='12px'></Divider>

                                <Form.Select
                                    field='selectedTheme'
                                    label={{ text: '主题色' }}
                                    initValue={config.selectedTheme}
                                    style={{ width: '100%' }}
                                >
                                    <Select.Option label='theme0' value={0}></Select.Option>
                                    <Select.Option label='theme1' value={1}></Select.Option>
                                    <Select.Option label='theme2' value={2}></Select.Option>
                                </Form.Select>

                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                                    <div style={{ width: '50%' }}>
                                        <Form.InputNumber
                                            field='nodeWidth'
                                            label={{ text: '节点宽度' }}
                                            initValue={config.nodeWidth}
                                            innerButtons
                                            suffix={<Tag size="small"
                                                style={{ fontSize: '12px', opacity: 0.8, color: "neutral-solid", marginRight: '5px' }}> px </Tag>}
                                        >
                                        </Form.InputNumber>
                                    </div>
                                    <div style={{ width: '50%' }}>
                                        <Form.InputNumber
                                            field='nodePaddingRatio'
                                            label={{ text: '节点垂直间距' }}
                                            initValue={config.nodePaddingRatio}
                                            innerButtons
                                            suffix={<Tag size="small"
                                                style={{ fontSize: '12px', opacity: 0.8, color: "neutral-solid", marginRight: '5px' }}> px </Tag>}
                                        >
                                        </Form.InputNumber>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                                    <div style={{ width: '50%' }}>
                                        <Form.InputNumber
                                            field='nodeOpacity'
                                            label={{ text: '节点透明度' }}
                                            initValue={config.nodeOpacity}
                                            innerButtons
                                            suffix={<Tag size="small"
                                                style={{ fontSize: '12px', opacity: 0.8, color: "neutral-solid", marginRight: '5px' }}> % </Tag>}
                                        >
                                        </Form.InputNumber>
                                    </div>
                                    <div style={{ width: '50%' }}>
                                        <Form.InputNumber
                                            field='linkOpacity'
                                            label={{ text: '连接透明度' }}
                                            initValue={config.linkOpacity}
                                            innerButtons
                                            suffix={<Tag size="small"
                                                style={{ fontSize: '12px', opacity: 0.8, color: "neutral-solid", marginRight: '5px' }}> % </Tag>}
                                        >
                                        </Form.InputNumber>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                                    <div style={{ width: '50%' }}>
                                        <Form.InputNumber
                                            field='textSize'
                                            label={{ text: '标注字体大小' }}
                                            initValue={config.textSize}
                                            innerButtons
                                        >
                                        </Form.InputNumber>
                                    </div>
                                    <div style={{ width: '50%' }}>
                                        <Form.Select
                                            field='textWeight'
                                            label={{ text: '标注字体粗细' }}
                                            initValue={config.textWeight}
                                            style={{ width: '100%' }}
                                        >
                                            <Select.Option label='普通' value={'normal'}></Select.Option>
                                            <Select.Option label='粗' value={'bolder'}></Select.Option>
                                            <Select.Option label='细' value={'lighter'}></Select.Option>
                                        </Form.Select>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                                    <div style={{ width: '50%' }}>
                                        <Form.Select
                                            field='nodeAlign'
                                            label={{ text: '节点对齐方式' }}
                                            initValue={config.nodeAlign}
                                            style={{ width: '100%' }}
                                        >
                                            <Select.Option label='靠右' value={'right'}></Select.Option>
                                            <Select.Option label='靠左' value={'left'}></Select.Option>
                                            <Select.Option label='左右分布' value={'justify'}></Select.Option>
                                        </Form.Select>
                                    </div>
                                    <div style={{ width: '50%' }}>
                                        <Form.Slot label={{ text: '标注字体颜色' }}>
                                            <ColorPicker
                                                defaultValue={config.textColor}
                                                onChange={(value, hex) => {
                                                    console.log(value, hex)
                                                    setConfig((prevConfig) => ({
                                                        ...prevConfig,
                                                        textColor: hex,
                                                    }))
                                                }}
                                            />
                                        </Form.Slot>

                                    </div>
                                </div>

                                <Form.Checkbox
                                    field='showNodeValue'
                                    labelPosition='inset'
                                    label={{ text: '显示节点数值' }}
                                >
                                    显示节点数值
                                </Form.Checkbox>



                                <div style={{ height: '150px' }}></div>
                            </Form>

                        )}
                        <div style={{
                            position: 'fixed', bottom: '20px', right: '20px',
                            display: 'flex', justifyContent: 'flex-end', gap: '10px'
                        }}>
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




