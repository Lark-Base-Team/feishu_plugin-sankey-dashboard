import './App.css';
import {
    DashboardState, SourceType,
    IDataRange, AllDataRange,
    DATA_SOURCE_SORT_TYPE,
    GroupMode, ORDER,
    bitable, dashboard,
    ICategory, IConfig, IData,
    FieldType, ISeries, Rollup,
    IDataCondition,
} from "@lark-base-open/js-sdk";
import {
    ColorPicker,
    ConfigProvider,
    Row, Col, GetProp
} from 'antd';
import { Sankey, G2, Datum } from "@antv/g2plot";
import * as themeData from './g2plot_theme.json';
import {
    Form, Tag, Checkbox, Button,
    Select, Switch, Notification,
    Divider, InputNumber, Card, Typography
} from '@douyinfe/semi-ui';
import html2canvas from 'html2canvas';
import { } from '@douyinfe/semi-icons';
import { useState, useEffect, useRef, useCallback } from 'react';
import dayjs from 'dayjs';

import './i18n';
import { useTranslation } from 'react-i18next';
import classnames from 'classnames'


import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en';

dayjs.locale('zh-cn');
//colors here only for option showing
const colorThemes = []
for (let key of Object.keys(themeData)) {
    if (key !== 'default') {
        const colors = themeData[key].styleSheet.paletteQualitative10
        colorThemes.push({ value: key, colors: colors })
    }
}

interface IFormValues {
    tableId: any;
    dataRange: any;
    source_col: any,
    value_col: any,
    target_col: any,
}
interface ITableSource {
    tableId: string;
    tableName: string;
}

export default function App() {
    const { t } = useTranslation();
    const [chartError, setchartError] = useState<boolean>(false);
    const chartContainerRef = useRef(null);
    const [chartCompeleted, setChartCompeleted] = useState(false);
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
    const [renderData, setRenderData] = useState<IData>([]);
    const formRef = useRef(null);
    const [initFormValue, setInitFormValue] = useState<IFormValues>();
    const [pageTheme, setPageTheme] = useState('LIGHT');
    const [config, setConfig] = useState({
        tableId: '',
        dataRange: { type: 'ALL' },
        source_col: null,
        value_col: null,
        target_col: null,
        selectedTheme: 'theme00',
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

    const url = new URL(window.location.href);

    const isCreate = dashboard.state === DashboardState.Create
    /** 是否配置模式下 */
    const isConfig = dashboard.state === DashboardState.Config || isCreate;

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

    useEffect(() => {
        async function a() {
            bitable.bridge.onThemeChange((event) => {
                setPageTheme(event.data.theme);
            });
            const theme = await bitable.bridge.getTheme();
            //console.log('addon detect theme changed', theme)
            setPageTheme(theme);
        }
        a()
    }, [isConfig, isCreate])

    useEffect(() => {
        const offConfigChange = dashboard.onConfigChange((r) => {
            // 监听配置变化，协同修改配置
            setConfig(r.data.customConfig as any);
        });
        return () => {
            offConfigChange();
        }
    }, []);

    const onClick = () => {
        console.log(config)
        // 保存配置
        dashboard.saveConfig({
            customConfig: config,
            dataConditions: [{
                tableId: config.tableId,
                dataRange: config.dataRange,
                series: 'COUNTA',
                groups: [
                    {
                        fieldId: categories[0],
                        mode: GroupMode.INTEGRATED,
                        sort: {
                            order: ORDER.ASCENDING,
                            sortType: DATA_SOURCE_SORT_TYPE.VIEW
                        }
                    }
                ]
            }],
        } as any)
    }

    useEffect(() => {
        async function initView() {
            const dbConfig = await dashboard.getConfig();
            //console.log(dbConfig.customConfig.dataRange)

            const { customConfig, dataConditions } = dbConfig
            for (let key of Object.keys(customConfig)) {
                let val: unknown;
                if (key === 'dataRange') {
                    if (typeof (customConfig.dataRange) === 'string') {
                        val = JSON.parse(customConfig[key] as string)
                    } else {
                        val = customConfig[key];
                    }
                } else {
                    val = customConfig[key];
                }
                setConfig((prevConfig) => ({
                    ...prevConfig,
                    [key]: val,
                }))
            }
        }
        if (dashboard.state === DashboardState.View) {
            initView()
        }
    }, [])

    useEffect(() => {
        if (dashboard.state === DashboardState.Config || dashboard.state === DashboardState.Create) {
            async function init() {
                const tableList = await getTableList();
                setTableSource(tableList);

                let previewConfig: IDataCondition = {} as IDataCondition
                let formInitValue: IFormValues = {} as IFormValues

                if (dashboard.state === DashboardState.Create) {
                    const tableId = tableList[0]?.tableId;
                    const [tableRanges, categories] = await Promise.all([getTableRange(tableId), getCategories(tableId)]);
                    //console.log(tableRanges)
                    setDataRange(tableRanges);
                    setCategories(categories);

                    previewConfig = {
                        tableId: tableList[0]?.tableId,
                        dataRange: tableRanges[0],
                        series: 'COUNTA',
                        groups: [
                            {
                                fieldId: categories[0].fieldId,
                                mode: GroupMode.INTEGRATED,
                                sort: {
                                    order: ORDER.ASCENDING,
                                    sortType: DATA_SOURCE_SORT_TYPE.VIEW
                                }
                            },
                            //{
                            //    fieldId: categories[1].fieldId,
                            //    mode: GroupMode.INTEGRATED,
                            //    sort: {
                            //        order: ORDER.ASCENDING,
                            //        sortType: DATA_SOURCE_SORT_TYPE.VIEW
                            //    }
                            //},
                        ]
                    }
                    formInitValue = {
                        tableId: tableList[0]?.tableId,
                        dataRange: tableRanges[0],
                        source_col: null,
                        value_col: null,
                        target_col: null,
                    }

                    setConfig((prevConfig) => ({
                        ...prevConfig,
                        tableId: tableId,
                        dataRange: tableRanges[0]
                    }))
                    //console.log('create mode formInitValue', formInitValue)
                } else {
                    const dbConfig = await dashboard.getConfig();
                    const { dataConditions, customConfig } = dbConfig;
                    let { tableId, dataRange, groups, series } = dataConditions[0];
                    const [tableRanges, categories] = await Promise.all([getTableRange(tableId), getCategories(tableId)]);
                    setDataRange(tableRanges);
                    setCategories(categories);
                    previewConfig = {
                        tableId: tableId,
                        dataRange: dataRange,
                        series: series,
                        groups: groups
                    }
                    formInitValue = {
                        tableId: tableId,
                        dataRange: typeof (dataRange) === 'string' ?
                            (JSON.parse(dataRange)) : (dataRange),
                        source_col: customConfig.source_col,
                        value_col: customConfig.value_col,
                        target_col: customConfig.target_col,
                    }

                    setConfig((prevConfig) => ({
                        ...prevConfig,
                        tableId: tableId,
                        dataRange: dataRange,
                        source_col: customConfig.source_col,
                        value_col: customConfig.value_col,
                        target_col: customConfig.target_col,
                    }))
                    //console.log('formInitValue', formInitValue)
                }

                setInitFormValue(formInitValue)
                const data = await dashboard.getPreviewData(previewConfig);
            }
            init()
        }
    }, []);

    const [delayHandler, setDelayHandler] = useState(null);
    useEffect(() => {
        function getAColDatainfo(fieldIdList) {
            const previewData: IDataCondition = {
                tableId: config.tableId,
                dataRange: config.dataRange as IDataRange,
                groups: [{
                    fieldId: fieldIdList[0],
                    mode: GroupMode.INTEGRATED,
                    sort: {
                        order: ORDER.ASCENDING,
                        sortType: DATA_SOURCE_SORT_TYPE.VIEW
                    }
                }],
                series: [
                    {
                        fieldId: fieldIdList[2],
                        rollup: Rollup.MAX
                    }
                ]
            }
            return previewData
        }
        const findNameById = (data: any, id: string): string | undefined => {
            const item = data.find((item: { id: string; }) => item.id === id);
            return item ? item.name : undefined;
        };

        const calcuChartData_drawChart = async () => {
            const table = await bitable.base.getTableById(config.tableId);
            let fieldMetaList, recordIdList;
            if (config.dataRange.type !== 'ALL') {
                const view = await table.getViewById((config.dataRange as { type: string; viewId: string }).viewId);
                fieldMetaList = await view.getFieldMetaList();
                recordIdList = await view.getVisibleRecordIdList();
            } else {
                fieldMetaList = await table.getFieldMetaList();
                recordIdList = await table.getRecordIdList();
            }

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
                            theme: themeData[config.selectedTheme],
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
            if (config.source_col === config.target_col ||
                config.target_col === config.value_col ||
                config.source_col === config.value_col) {
                Notification.warning({
                    id: 'duplicateNotification',
                    title: t('请选择不同列'),
                    content: t('起点、终点和数值列需要输入不同的字段数据'),
                    duration: 0,
                    position: 'topLeft',
                    theme: pageTheme === 'DARK' ? ('light') : ('normal')
                })
            } else {
                Notification.close('duplicateNotification');
                if (delayHandler) {
                    clearTimeout(delayHandler);
                }
                const newDelayHandler = setTimeout(() => {
                    calcuChartData_drawChart();
                    setChartCompeleted(true);
                }, 300);

                setDelayHandler(newDelayHandler);
            }
        }
        return () => {
            if (delayHandler) {
                clearTimeout(delayHandler);
            }
        };
    }, [config])

    async function getViewData({ tableId, viewId }) {
        const table = await bitable.base.getTableById(tableId);
        const view = await table.getViewById(viewId);
        const viewMeta = await view.getFieldMetaList();
        const visibleRecordIdList = await view.getVisibleRecordIdList();
        const visibleFieldIdList = await view.getVisibleFieldIdList();
        return {
            meta: viewMeta,
            visibleRecordIdList: visibleRecordIdList,
            visibleFieldIdList: visibleFieldIdList,
        };
    }

    const handleConfigChange = async (values: any, changedField: any) => {
        if (changedField.tableId) {
            const tableRanges = await getTableRange(changedField.tableId);
            setDataRange(tableRanges);
            const categories = await getCategories(changedField.tableId);
            setCategories(categories);
            if (formRef.current) {
                formRef.current.formApi.setValue('dataRange', JSON.stringify(tableRanges[0]))
            }
        } if (changedField.dataRange) {
            if (config.dataRange.type !== 'ALL') {
                const viewData = await getViewData({ tableId: config.tableId, viewId: JSON.parse(changedField.dataRange).viewId })
                const categoriesView = []
                for (let i of viewData.meta) {
                    if (viewData.visibleFieldIdList.includes(i.id)) {
                        categoriesView.push({ fieldId: i.id, fieldName: i.name, fieldType: i.type })
                    }
                }
                setCategories(categoriesView)
                console.log(categoriesView)
            }
            if (formRef.current) {
                formRef.current.formApi.setValue('source_col', null)
                formRef.current.formApi.setValue('target_col', null)
                formRef.current.formApi.setValue('value_col', null)
            }
        }


        const key = Object.keys(changedField)[0];
        let val: any
        if (key === 'dataRange') {
            val = typeof (changedField[key]) === 'string' ?
                (JSON.parse(changedField[key])) : (changedField[key]);
        } else {
            val = changedField[key]
        }

        setConfig((prevConfig) => ({
            ...prevConfig,
            [key]: val,
        }))
    }
    const renderCustomOption_tableSVG = (item: any) => {
        return (
            <Select.Option
                value={item.tableId}
                showTick={false}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src='./table.svg' />
                    {item.tableName}
                </div>
            </Select.Option>
        )
    };
    const renderCustomOption_tableSVG_dataRange = (item: any) => {
        return item.type === 'VIEW' ? (
            <Select.Option
                value={JSON.stringify(item)}
                showTick={false}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src='./table.svg' />
                    {item.viewName}
                </div>
            </Select.Option>
        ) : (
            <Select.Option
                value={JSON.stringify(item)}
                showTick={false}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src='./table.svg' />
                    {t('全部数据')}
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
                iconPath = './text.svg'; // 设置多行文本图标路径
                break;
            case FieldType.Number:
                iconPath = './number.svg'; // 设置数字图标路径
                break;
            case FieldType.SingleSelect:
                iconPath = ''; // 设置单选图标路径
                break;
            case FieldType.MultiSelect:
                iconPath = ''; // 设置多选图标路径
                break;
            case FieldType.DateTime:
                iconPath = './date.svg'; // 设置日期图标路径
                break;
            case FieldType.Checkbox:
                iconPath = ''; // 设置复选框图标路径
                break;
            case FieldType.User:
                iconPath = './person.svg'; // 设置人员图标路径
                break;
            case FieldType.Phone:
                iconPath = './phoneNumber.svg'; // 设置电话图标路径
                break;
            case FieldType.Url:
                iconPath = './URL.svg'; // 设置超链接图标路径
                break;
            case FieldType.Email:
                iconPath = './Email.svg'; // 设置電子郵件图标路径
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
    };
    const saveAsImage = () => {
        const chartContainer = chartContainerRef.current;

        if (chartContainer) {
            html2canvas(chartContainer)
                .then((canvas: { toDataURL: (arg0: string) => any; }) => {
                    const imgData = canvas.toDataURL('image/png');
                    const link = document.createElement('a');
                    link.href = imgData;
                    link.download = 'chart.png';
                    link.click();
                })
                .catch((error) => {
                    console.error('Error saving chart as image:', error);
                });
        }
    };
    const { Text } = Typography;

    return (
        <main className={classnames({
            'main-config': isConfig,
            'main': true,
        })}>
            <div className='content' style={{ position: 'relative' }}>
                <div id='sankeyChart' ref={chartContainerRef} style={{ position: 'absolute', width: '95%', height: '95%' }}></div>
                {chartCompeleted ? null : (
                    <div style={{ position: 'absolute', zIndex: 1 }}>
                        <Card
                            className={pageTheme === 'DARK' ? ('semi-always-dark') : ('semi-always-light')}
                            title={t('选择具体的数据来源')}
                            style={{ maxWidth: 360 }}
                            headerExtraContent={
                                <Text link={{ href: 'https://feishu.feishu.cn/docx/N1wqdy33DosUU7xVz9icNacOnrf?from=from_copylink', target: '_blank' }}>
                                    {t('帮助文档')}
                                </Text>
                            }
                        >
                            {t('在配置页中选取用于绘图的具体数据😀')}<br />{t('仅建议使用文本和数字字段作为数据来源')}
                        </Card>
                    </div>
                )}
                {/* 
                <Card className='semi-always-dark'>
                    init form value:<br />
                    {JSON.stringify(initFormValue)}
                    <br /><br /><br />temp config:<br />
                    {JSON.stringify(config)}
                </Card>
                */}
            </div>
            {dashboard.state === DashboardState.Config || dashboard.state === DashboardState.Create ? (
                <div style={{ position: 'relative' }}>
                    <div
                        className='config-panel'
                        style={{
                            overflowY: 'scroll', // 仅纵向滚动
                            overflowX: 'hidden', // 禁止横向滚动
                            paddingLeft: '15px',
                            flex: '1 1 auto', // 自动扩展并占据剩余空间
                            maxHeight: 'calc(100vh - 60px)', // 确保内容区高度不超过100vh减去按钮区高度
                        }}
                    >
                        {tableSource[0] && dataRange[0] && initFormValue?.tableId ? (
                            <Form
                                className={pageTheme === 'DARK' ? ('semi-always-dark') : ('semi-always-light')}
                                layout='vertical'
                                style={{ width: 300 }}
                                ref={formRef}
                                onValueChange={handleConfigChange}
                            >
                                <Form.Select
                                    dropdownClassName={pageTheme === 'DARK' ? ('semi-always-dark') : ('semi-always-light')}
                                    dropdownStyle={{ backgroundColor: 'var(--semi-color-bg-2)' }}
                                    field='tableId'
                                    label={t('数据源')}
                                    initValue={initFormValue.tableId}
                                    style={{ width: '100%', display: 'flex' }}
                                >
                                    {tableSource.map(source => renderCustomOption_tableSVG(source))}
                                </Form.Select>
                                <Form.Select
                                    dropdownClassName={pageTheme === 'DARK' ? ('semi-always-dark') : ('semi-always-light')}
                                    dropdownStyle={{ backgroundColor: 'var(--semi-color-bg-2)' }}
                                    field='dataRange'
                                    label={t('数据范围')}
                                    initValue={JSON.stringify(initFormValue.dataRange)}
                                    style={{ width: '100%' }}
                                >
                                    {dataRange.map(view => renderCustomOption_tableSVG_dataRange(view))}
                                </Form.Select>

                                <Divider margin='12px'></Divider>

                                <Form.Select
                                    dropdownClassName={pageTheme === 'DARK' ? ('semi-always-dark') : ('semi-always-light')}
                                    dropdownStyle={{ backgroundColor: 'var(--semi-color-bg-2)' }}
                                    field='source_col'
                                    label={t('起点列')}
                                    placeholder={t('选择起点数据')}
                                    initValue={config.source_col}
                                    style={{ width: '100%' }}
                                >
                                    {categories.map(source => renderCustomOption_col(source))}
                                </Form.Select>
                                <Form.Select
                                    dropdownClassName={pageTheme === 'DARK' ? ('semi-always-dark') : ('semi-always-light')}
                                    dropdownStyle={{ backgroundColor: 'var(--semi-color-bg-2)' }}
                                    field='target_col'
                                    label={t('终点列')}
                                    placeholder={t('选择终点数据')}
                                    initValue={config.target_col}
                                    style={{ width: '100%' }}
                                >
                                    {categories.map(source => renderCustomOption_col(source))}
                                </Form.Select>
                                <Form.Select
                                    dropdownClassName={pageTheme === 'DARK' ? ('semi-always-dark') : ('semi-always-light')}
                                    dropdownStyle={{ backgroundColor: 'var(--semi-color-bg-2)' }}
                                    field='value_col'
                                    label={t('数值列')}
                                    placeholder={t('控制连接流量大小')}
                                    initValue={config.value_col}
                                    style={{ width: '100%' }}
                                >
                                    {categories.map(source => renderCustomOption_col(source))}
                                </Form.Select>

                                <Divider margin='12px'></Divider>

                                <Form.Select
                                    dropdownClassName={pageTheme === 'DARK' ? ('semi-always-dark') : ('semi-always-light')}
                                    dropdownStyle={{ backgroundColor: 'var(--semi-color-bg-2)' }}
                                    field='selectedTheme'
                                    label={t('主题色')}
                                    initValue={config.selectedTheme}
                                    style={{ width: '100%' }}
                                >
                                    {colorThemes.map((theme, index) =>
                                        <Select.Option
                                            value={theme.value}
                                            label={
                                                <div style={{ display: 'flex', borderRadius: '3px', overflow: 'hidden' }}>

                                                    {theme.colors.map((color, index) => (
                                                        <div key={index} style={{ backgroundColor: color, height: '15px', width: '20px' }} />
                                                    ))}
                                                </div>
                                            }
                                        >
                                        </Select.Option>
                                    )}
                                </Form.Select>

                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                                    <div style={{ width: '50%' }}>
                                        <Form.InputNumber
                                            field='nodeWidth'
                                            label={t('节点宽度')}
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
                                            label={t('节点垂直间距')}
                                            initValue={config.nodePaddingRatio}
                                            innerButtons
                                            suffix={<Tag
                                                size="small"
                                                style={{ fontSize: '12px', opacity: 0.8, color: "neutral-solid", marginRight: '5px' }}
                                            > px </Tag>}
                                            labelWidth={'140px'}
                                        >
                                        </Form.InputNumber>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                                    <div style={{ width: '50%' }}>
                                        <Form.InputNumber
                                            field='nodeOpacity'
                                            label={t('节点透明度')}
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
                                            label={t('连接透明度')}
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
                                            label={t('标注字体大小')}
                                            initValue={config.textSize}
                                            innerButtons
                                        >
                                        </Form.InputNumber>
                                    </div>
                                    <div style={{ width: '50%' }}>
                                        <Form.Select
                                            dropdownClassName={pageTheme === 'DARK' ? ('semi-always-dark') : ('semi-always-light')}
                                            dropdownStyle={{ backgroundColor: 'var(--semi-color-bg-2)' }}
                                            field='textWeight'
                                            label={t('标注字体粗细')}
                                            initValue={config.textWeight}
                                            style={{ width: '100%' }}
                                        >
                                            <Select.Option label={t('普通')} value={'normal'}></Select.Option>
                                            <Select.Option label={t('粗')} value={'bolder'}></Select.Option>
                                            <Select.Option label={t('细')} value={'lighter'}></Select.Option>
                                        </Form.Select>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                                    <div style={{ width: '50%' }}>
                                        <Form.Select
                                            dropdownClassName={pageTheme === 'DARK' ? ('semi-always-dark') : ('semi-always-light')}
                                            dropdownStyle={{ backgroundColor: 'var(--semi-color-bg-2)' }}
                                            field='nodeAlign'
                                            label={t('节点对齐方式')}
                                            initValue={config.nodeAlign}
                                            style={{ width: '100%' }}
                                        >
                                            <Select.Option label={t('靠右')} value={'right'}></Select.Option>
                                            <Select.Option label={t('靠左')} value={'left'}></Select.Option>
                                            <Select.Option label={t('左右分布')} value={'justify'}></Select.Option>
                                        </Form.Select>
                                    </div>
                                    <div style={{ width: '50%' }}>
                                        <Form.Slot label={t('标注字体颜色')}>
                                            <ColorPicker
                                                className='colorPicker'
                                                defaultValue={config.textColor}
                                                onChange={(value, hex) => {
                                                    console.log(value, hex)
                                                    setConfig((prevConfig) => ({
                                                        ...prevConfig,
                                                        textColor: hex,
                                                    }))
                                                }}
                                                placement='topLeft'
                                            //panelRender={}
                                            />
                                        </Form.Slot>

                                    </div>
                                </div>

                                <Form.Checkbox
                                    field='showNodeValue'
                                    labelPosition='inset'
                                >
                                    {t('显示节点数值')}
                                </Form.Checkbox>
                            </Form>

                        ) : null}
                    </div>


                    <div
                        className={pageTheme === 'DARK' ? ('semi-always-dark') : ('semi-always-light')}
                        style={{
                            display: 'flex', justifyContent: 'flex-end',
                            bottom: '0', height: '50px', flexShrink: '0', // 防止高度收缩
                            borderLeft: '1px solid rgba(222, 224, 227, 0.15)',
                            paddingRight: '15px', gap: '10px',
                        }}
                    >
                        <Button
                            className='btn'
                            size="default"
                            type="tertiary"
                            style={{ minWidth: '80px', width: 'auto' }}
                            onClick={saveAsImage}
                            disabled={!chartCompeleted}
                        >
                            {t('保存图片')}
                        </Button>
                        <Button
                            className='btn'
                            size="default"
                            type="primary"
                            theme='solid'
                            style={{ width: '80px' }}
                            onClick={onClick}
                        >
                            {t('确定')}
                        </Button>
                    </div>
                </div>
            ) : null}

        </main>
    )
}



