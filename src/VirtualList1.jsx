import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Subscription, BehaviorSubject, fromEvent, combineLatest } from 'rxjs'
import { filter, pairwise, startWith, tap, withLatestFrom, map } from 'rxjs/operators'

export default class VirtualList1 extends Component {
    static propTypes = {
       
    }
    state = {
        scrollHeight: 0,
        data: []
    }

    containerRef = React.createRef(null);
   
    snapShotData  = [];

    lastFirstIndex = -1;

    containerHeight$ = new BehaviorSubject(0)

    // sub用来挂载
    sub = new Subscription()


    componentDidMount(){
        const ele = this.containerRef.current;

        this.containerHeight$.next(ele.clientHeight);
        const scrollWin$ = fromEvent(ele, 'scroll').pipe(
            startWith({target: {scroll: 0}})
        )
 
        const scrollDir$ = scrollWin$.pipe(
            map(()=>ele.scrollTop),
            // 前后比较
            pairwise(),
            map(([ p, n ]) => n - p > 0? 1: -1 ),
            startWith(1)
        )

        // 实际需要的条数
        const acturalRows$ = combineLatest(
            this.containerHeight$,
            this.props.options$,
        ).pipe(
            map(([ all, { height }]) => Math.ceil(all/height) + 3)
        )

        // 是不是需要更新
        const shouldUpdate$ = combineLatest(
            acturalRows$,
            this.props.data$,
            this.props.options$,
            scrollWin$.pipe(map(()=>ele.scrollTop))
        ).pipe(
            map(([acturalRows, data, {height}, st]) => {
                const firstIndex = Math.floor(st/height);
                // 当实际的数量少于 我们预计的数量，firstIndex实际一直为0 ，就不会进行数据更新
                const maxIndex = data.length - acturalRows > 0 ? data.length - acturalRows: 0;
                return [firstIndex> maxIndex?maxIndex: firstIndex,  acturalRows]
            }),
            filter(([curIndex]) => curIndex!== this.lastFirstIndex),
            tap(([curIndex])=>this.lastFirstIndex = curIndex),
            map(([firstIndex, acturalRows]) => [firstIndex , firstIndex + acturalRows -1])
        )

        const sliceData$ = combineLatest(
            this.props.data$,
            this.props.options$,
            shouldUpdate$
        ).pipe(
            withLatestFrom(scrollDir$),
            map(([[ data, { height}, [firstIndex, lastIndex]], dr]) => {
                const sliceData = this.snapShotData;
                
                if(!sliceData.length){
                    return this.snapShotData = data.slice(firstIndex, lastIndex + 1 ).map(item=>({
                        origin: item,
                        $pos: firstIndex * height,
                        $index: firstIndex++,
                    }))
                }

                const diffIndexs = this.getDiffIndexs( sliceData, firstIndex, lastIndex);
                
                let newIndex = dr > 0 ? lastIndex - diffIndexs.length + 1: firstIndex;
                diffIndexs.forEach(item=>{
                    const oldItem = sliceData[item];
                    oldItem.origin = data[newIndex];
                    oldItem.$pos = newIndex * height;
                    oldItem.$index = newIndex++ ;
                })

                return this.snapShotData = sliceData;
            })
        )

        const srollHeight$ = combineLatest(
            this.props.data$,
            this.props.options$,
        ).pipe(
            map(([data, { height}]) => data.length * height)
        );

        this.sub.add(
            combineLatest(sliceData$ , srollHeight$).subscribe(
                ([data, scrollHeight]) => this.setState({data, scrollHeight})
            )
        )

    }

    componentWillUnmount(){
        this.sub.unsubscribe()
    }

    getDiffIndexs = ( data, firstIndex , lastIndex) =>{
       const indexes = [];
       data.forEach((item,i)=>{
          if(item.$index < firstIndex || item.$index > lastIndex){
            indexes.push(i)
          }
       })
       return indexes
    }

    render() {
        const { data, scrollHeight } = this.state;
        return (
            <div style={{
                margin: '20px auto',
                width: 200,
                height: 200,
                border: '1px solid #333',
                overflow: 'auto'
            }}
              ref={this.containerRef}
            >
                <div
                    style={{
                        height: scrollHeight,
                        position: 'relative',
                    }}
                >
                   {
                       data.map((item,index)=>{
                         return  <div
                              key={index}
                              style={{
                                  position: 'absolute',
                                  transform: `translateY(${item.$pos}px)`
                              }}
                           >
                              {(this.props.children)(item.origin)}
                           </div>
                       })
                   }
                </div>
            </div>
        )
    }
}
