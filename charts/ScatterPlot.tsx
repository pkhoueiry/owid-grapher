/* ScatterPlot.tsx
 * ================
 *
 * Entry point for scatter charts
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-03-09
 */

import * as React from "react"
import { observable, computed, action } from "mobx"
import { intersection, without, compact, uniq } from "./Util"
import { observer } from "mobx-react"
import { Bounds } from "./Bounds"
import { ChartConfig } from "./ChartConfig"
import { NoData } from "./NoData"
import {
    PointsWithLabels,
    ScatterSeries,
    ScatterValue
} from "./PointsWithLabels"
import { TextWrap } from "./TextWrap"
import { ConnectedScatterLegend } from "./ConnectedScatterLegend"
import {
    VerticalColorLegend,
    ScatterColorLegendView
} from "./ScatterColorLegend"
import { AxisBox, AxisBoxView } from "./AxisBox"
import { ComparisonLine } from "./ComparisonLine"
import { ScaleType } from "./AxisScale"
import { first, last } from "./Util"

@observer
export class ScatterPlot extends React.Component<{
    bounds: Bounds
    config: ChartConfig
    isStatic: boolean
}> {
    // currently hovered individual series key
    @observable hoverKey?: string
    // currently hovered legend color
    @observable hoverColor?: string

    @computed get chart(): ChartConfig {
        return this.props.config
    }

    @computed get transform() {
        return this.chart.scatter
    }

    @computed.struct get bounds(): Bounds {
        return this.props.bounds
    }

    @action.bound onTargetChange({
        targetStartYear,
        targetEndYear
    }: {
        targetStartYear: number
        targetEndYear: number
    }) {
        this.chart.timeDomain = [targetStartYear, targetEndYear]
    }

    @action.bound onSelectEntity(datakey: string) {
        if (this.chart.addCountryMode !== "disabled")
            this.chart.data.toggleKey(datakey)
    }

    // Only want to show colors on legend that are actually on the chart right now
    @computed get colorsInUse() {
        return uniq(
            this.transform.currentData
                .filter(g => g.isAutoColor)
                .map(g => g.color)
        )
    }

    @computed get legend(): VerticalColorLegend {
        const that = this
        return new VerticalColorLegend({
            get maxWidth() {
                return that.sidebarMaxWidth
            },
            get fontSize() {
                return that.chart.baseFontSize
            },
            get colorables() {
                return that.transform.colors.colorables.filter(c =>
                    that.colorsInUse.includes(c.color)
                )
            }
        })
    }

    @action.bound onLegendMouseOver(color: string) {
        this.hoverColor = color
    }

    @action.bound onLegendMouseLeave() {
        this.hoverColor = undefined
    }

    // When the color legend is clicked, toggle selection fo all associated keys
    @action.bound onLegendClick() {
        const { chart, hoverColor } = this
        if (chart.addCountryMode === "disabled" || hoverColor === undefined)
            return

        const { transform } = this
        const keysToToggle = transform.currentData
            .filter(g => g.color === hoverColor)
            .map(g => g.key)
        const allKeysActive =
            intersection(keysToToggle, chart.data.selectedKeys).length ===
            keysToToggle.length
        if (allKeysActive)
            chart.data.selectedKeys = without(
                chart.data.selectedKeys,
                ...keysToToggle
            )
        else
            chart.data.selectedKeys = uniq(
                chart.data.selectedKeys.concat(keysToToggle)
            )
    }

    // Colors on the legend for which every matching group is focused
    @computed get focusColors(): string[] {
        const { colorsInUse, transform, chart } = this
        return colorsInUse.filter(color => {
            const matchingKeys = transform.currentData
                .filter(g => g.color === color)
                .map(g => g.key)
            return (
                intersection(matchingKeys, chart.data.selectedKeys).length ===
                matchingKeys.length
            )
        })
    }

    // All currently hovered group keys, combining the legend and the main UI
    @computed get hoverKeys(): string[] {
        const { hoverColor, hoverKey, transform } = this

        const hoverKeys =
            hoverColor === undefined
                ? []
                : uniq(
                      transform.currentData
                          .filter(g => g.color === hoverColor)
                          .map(g => g.key)
                  )

        if (hoverKey !== undefined) hoverKeys.push(hoverKey)

        return hoverKeys
    }

    @computed get focusKeys(): string[] {
        return this.chart.data.selectedKeys
    }

    @computed get arrowLegend(): ConnectedScatterLegend | undefined {
        const { transform } = this
        const { startYear, endYear } = transform

        if (startYear === endYear || transform.isRelativeMode) return undefined

        const that = this
        return new ConnectedScatterLegend({
            get maxWidth() {
                return that.sidebarWidth
            },
            get fontSize() {
                return that.chart.baseFontSize
            },
            get startYear() {
                return that.transform.startYear
            },
            get endYear() {
                return that.transform.endYear
            },
            get endpointsOnly() {
                return that.transform.compareEndPointsOnly
            },
            formatYearFunction: that.chart.formatYearFunction
        })
    }

    @action.bound onScatterMouseOver(series: ScatterSeries) {
        this.hoverKey = series.key
    }

    @action.bound onScatterMouseLeave() {
        this.hoverKey = undefined
    }

    @action.bound onScatterClick() {
        if (this.hoverKey) this.onSelectEntity(this.hoverKey)
    }

    @computed get tooltipSeries(): ScatterSeries | undefined {
        const { hoverKey, focusKeys, transform } = this
        if (hoverKey !== undefined)
            return transform.currentData.find(g => g.key === hoverKey)
        else if (focusKeys && focusKeys.length === 1)
            return transform.currentData.find(g => g.key === focusKeys[0])
        else return undefined
    }

    @computed get sidebarMaxWidth() {
        return this.bounds.width * 0.5
    }
    @computed get sidebarMinWidth() {
        return 100
    }
    @computed.struct get sidebarWidth() {
        const { sidebarMinWidth, sidebarMaxWidth, legend } = this
        return Math.max(
            Math.min(legend.width, sidebarMaxWidth),
            sidebarMinWidth
        )
    }

    @computed get axisBox() {
        const that = this
        return new AxisBox({
            get bounds() {
                return that.bounds.padRight(that.sidebarWidth + 20)
            },
            get fontSize() {
                return that.chart.baseFontSize
            },
            get xAxis() {
                return that.transform.xAxis
            },
            get yAxis() {
                return that.transform.yAxis
            }
        })
    }

    @action.bound onYScaleChange(scaleType: ScaleType) {
        this.chart.yAxis.scaleType = scaleType
    }

    @action.bound onXScaleChange(scaleType: ScaleType) {
        this.chart.xAxis.scaleType = scaleType
    }

    @computed get comparisonLines() {
        return this.chart.comparisonLines
    }

    @action.bound onToggleEndpoints() {
        this.transform.compareEndPointsOnly = !this.transform
            .compareEndPointsOnly
    }

    // Colors currently on the chart and not greyed out
    @computed get activeColors(): string[] {
        const { hoverKeys, focusKeys, transform } = this
        const activeKeys = hoverKeys.concat(focusKeys)

        if (activeKeys.length === 0)
            // No hover or focus means they're all active by default
            return uniq(transform.currentData.map(g => g.color))
        else
            return uniq(
                transform.currentData
                    .filter(g => activeKeys.indexOf(g.key) !== -1)
                    .map(g => g.color)
            )
    }

    @computed get hideLines(): boolean {
        return !!this.chart.props.hideConnectedScatterLines
    }

    render() {
        if (this.transform.failMessage)
            return (
                <NoData
                    bounds={this.bounds}
                    message={this.transform.failMessage}
                />
            )

        const {
            transform,
            bounds,
            axisBox,
            legend,
            focusKeys,
            hoverKeys,
            focusColors,
            activeColors,
            arrowLegend,
            sidebarWidth,
            tooltipSeries,
            comparisonLines,
            hideLines
        } = this
        const { currentData, sizeDomain } = transform

        return (
            <g>
                <AxisBoxView
                    axisBox={axisBox}
                    onXScaleChange={this.onXScaleChange}
                    onYScaleChange={this.onYScaleChange}
                    showTickMarks={false}
                />
                {comparisonLines &&
                    comparisonLines.map((line, i) => (
                        <ComparisonLine
                            key={i}
                            axisBox={axisBox}
                            comparisonLine={line}
                        />
                    ))}
                <PointsWithLabels
                    hideLines={hideLines}
                    data={currentData}
                    bounds={axisBox.innerBounds}
                    xScale={axisBox.xScale}
                    yScale={axisBox.yScale}
                    sizeDomain={sizeDomain}
                    focusKeys={focusKeys}
                    hoverKeys={hoverKeys}
                    onMouseOver={this.onScatterMouseOver}
                    onMouseLeave={this.onScatterMouseLeave}
                    onClick={this.onScatterClick}
                />
                <ScatterColorLegendView
                    legend={legend}
                    x={bounds.right - sidebarWidth}
                    y={bounds.top}
                    onMouseOver={this.onLegendMouseOver}
                    onMouseLeave={this.onLegendMouseLeave}
                    onClick={this.onLegendClick}
                    focusColors={focusColors}
                    activeColors={activeColors}
                />
                {(arrowLegend || tooltipSeries) && (
                    <line
                        x1={bounds.right - sidebarWidth}
                        y1={bounds.top + legend.height + 2}
                        x2={bounds.right - 5}
                        y2={bounds.top + legend.height + 2}
                        stroke="#ccc"
                    />
                )}
                {arrowLegend && (
                    <g className="clickable" onClick={this.onToggleEndpoints}>
                        {arrowLegend.render(
                            bounds.right - sidebarWidth,
                            bounds.top + legend.height + 11
                        )}
                    </g>
                )}
                {tooltipSeries && (
                    <ScatterTooltip
                        formatY={transform.yFormatTooltip}
                        formatX={transform.xFormatTooltip}
                        formatYearFunction={this.chart.formatYearFunction}
                        series={tooltipSeries}
                        maxWidth={sidebarWidth}
                        fontSize={this.chart.baseFontSize}
                        x={bounds.right - sidebarWidth}
                        y={
                            bounds.top +
                            legend.height +
                            11 +
                            (arrowLegend ? arrowLegend.height + 10 : 0)
                        }
                    />
                )}
            </g>
        )
    }
}

interface ScatterTooltipProps {
    formatY: (value: number) => string
    formatX: (value: number) => string
    formatYearFunction: (value: number) => string
    series: ScatterSeries
    maxWidth: number
    fontSize: number
    x: number
    y: number
}

@observer
class ScatterTooltip extends React.Component<ScatterTooltipProps> {
    formatValueY(value: ScatterValue) {
        return "Y Axis: " + this.props.formatY(value.y)
        //        if (value.year != value.time.y)
        //            s += " (data from " + value.time.y + ")"
        // return s
    }

    formatValueX(value: ScatterValue) {
        let s = "X Axis: " + this.props.formatX(value.x)
        if (!value.time.span && value.time.y !== value.time.x)
            s += ` (data from ${value.time.x})`
        return s
    }

    render() {
        const { x, y, maxWidth, fontSize, series } = this.props
        const lineHeight = 5

        const firstValue = first(series.values)
        const lastValue = last(series.values)
        const values = compact(uniq([firstValue, lastValue]))

        const elements: Array<{ x: number; y: number; wrap: TextWrap }> = []
        let offset = 0

        const heading = {
            x: x,
            y: y + offset,
            wrap: new TextWrap({
                maxWidth: maxWidth,
                fontSize: 0.75 * fontSize,
                text: series.label
            })
        }
        elements.push(heading)
        offset += heading.wrap.height + lineHeight

        const formatFunction = this.props.formatYearFunction

        values.forEach(v => {
            const year = {
                x: x,
                y: y + offset,
                wrap: new TextWrap({
                    maxWidth: maxWidth,
                    fontSize: 0.65 * fontSize,
                    text: v.time.span
                        ? `${formatFunction(
                              v.time.span[0]
                          )} to ${formatFunction(v.time.span[1])}`
                        : formatFunction(v.time.y)
                })
            }
            offset += year.wrap.height
            const line1 = {
                x: x,
                y: y + offset,
                wrap: new TextWrap({
                    maxWidth: maxWidth,
                    fontSize: 0.55 * fontSize,
                    text: this.formatValueY(v)
                })
            }
            offset += line1.wrap.height
            const line2 = {
                x: x,
                y: y + offset,
                wrap: new TextWrap({
                    maxWidth: maxWidth,
                    fontSize: 0.55 * fontSize,
                    text: this.formatValueX(v)
                })
            }
            offset += line2.wrap.height + lineHeight
            elements.push(...[year, line1, line2])
        })

        return (
            <g className="scatterTooltip">
                {elements.map((el, i) =>
                    el.wrap.render(el.x, el.y, { key: i })
                )}
            </g>
        )
    }
}
