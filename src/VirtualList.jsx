import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Subscription, BehaviorSubject, combineLatest, fromEvent} from 'rxjs'
import { pairwise, startWith, map, tap, withLatestFrom, filter } from 'rxjs/operators'

// 将背景板的高度设置为非常的高
export default class vertualList extends Component {
    static propTypes = {
        // prop: PropTypes
    }
    
    state = {
        innerContainerHeight: 0,
        data: []
    }
    
    // 外面的container
    virtualListRef = React.createRef()
    // 上次的index
    lastFirstIndex = -1
    // 记录第一次的值， 后面只要比较更新一些值就是
    snapShotData = []
    // 外面的高度
    containerHeight$ = new BehaviorSubject(0)
     // 进行分发
    sub = new Subscription()


    componentDidMount(){
        const virtualDom = this.virtualListRef.current;
        
        // 存储当前的container的外面的高度
        this.containerHeight$.next(virtualDom.clientHeight);

        // 获取滚动事件的初始化
        const scrollWin$ = fromEvent(virtualDom, 'scroll').pipe(
            startWith({ target: { scrollTop: 0}})
        )

        // 看当前的滑动的方向 单个就不用combineLatest
        const scrollDir$ = scrollWin$.pipe(
            map(()=>virtualDom.scrollTop),
            pairwise(),
            map(([p,n]) => n - p> 0 ? 1 : -1),
            startWith(1)
        )

        // 默认显示的高度加 3 
        const actualRows$ = combineLatest(this.containerHeight$, this.props.options$).pipe(
            map(([ sh, { height}])=> Math.ceil(sh/height) + 3)
        )

        // 需要更新吗，并且返回firstIndex和lastIndex
        const shouldUpdate$ = combineLatest(
            scrollWin$.pipe(map(()=>virtualDom.scrollTop)),
            this.props.data$,
            this.props.options$,
            actualRows$ 
        ).pipe(
            map(([ st , data, { height }, actualRows])=>{
               const firstIndex = Math.floor(st/height);
                // 当实际的数量少于 我们预计的数量，firstIndex实际一直为0 ，就不会进行数据更新
               const maxIndex = data.length - actualRows < 0 ? 0 :  data.length - actualRows ;
               // 这个还能控制不超出，往下拉到最后不会超出1000的范围
               return [ firstIndex > maxIndex? maxIndex: firstIndex, actualRows]
            }),
            // 当超过一个div才更新数据
            filter(([curFirstIndex]) => curFirstIndex!==this.lastFirstIndex),
            // 更新当前的数据
            tap(([curFirstIndex])=>this.lastFirstIndex = curFirstIndex),
            map(([curFirstIndex, actualRows]) => [curFirstIndex, curFirstIndex + actualRows - 1])
        )

        // 更新的数据
        const dataInViewSlice$ = combineLatest(
            shouldUpdate$,
            this.props.data$,
            this.props.options$
        ).pipe(
            // 这个会多加一层
            withLatestFrom(scrollDir$),
            map(([[[firstIndex, lastIndex], data, { height}], sr]) => {
                const sliceData = this.snapShotData;
                if(!sliceData.length){
                    // debugger
                    return this.snapShotData = data.slice(firstIndex, lastIndex + 1).map(item=>({
                        origin: item,
                        $pos: height * firstIndex,
                        // 作为当前数据的索引，用于后面的比较
                        $index: firstIndex++
                    }))
                }
                
                // 取的是当前需要改变的数据的索引 这个有可能是多个的索引
                const diffIndexs = this.diffIndexChange( sliceData, firstIndex, lastIndex);
                 
                // 链接的代码有问题，当一下子太快多个的时候不一样， 所以该这么写
                let newIndex = sr > 0 ? lastIndex - diffIndexs.length + 1 : firstIndex
                
                //从小到大排列 的话
                // 由于是地址的，所以还是会改变的， 但不影响并列的
                diffIndexs.forEach((item)=>{
                    const changeItem = sliceData[item];
                    changeItem.origin = data[newIndex];
                    changeItem.$pos = newIndex * height;
                    changeItem.$index = newIndex ++;
                })
                return this.snapShotData = sliceData
            })
        )

        const scrollHeight$ = combineLatest(this.props.data$, this.props.options$).pipe(
            map(([data, { height}]) => data.length * height )
        )

        // 最后触发了
        this.sub.add(
            combineLatest(dataInViewSlice$, scrollHeight$).subscribe(
               ([data, scrollHeight]) => this.setState({
                   data, 
                   innerContainerHeight: scrollHeight
               })
            )
        )
    }

    componentWillUnmount(){
        this.sub.unsubscribe()
    }
    
    diffIndexChange = (sliceData, firstIndex, lastIndex) => {
        const indexes = [];
        sliceData.forEach((item,index)=>{
            if(item.$index < firstIndex  || item.$index > lastIndex) {
                indexes.push(index)
            }
        })
        //从小到大排列
        return indexes.sort((a,b)=>a-b)
    }

    render() {
        const { options$ } = this.props;
        const { innerContainerHeight, data } = this.state;
        return (
            <div
               style={{
                   width: 200,
                   height: 200,
                   border: '1px solid #333',
                   margin: '20px auto',
                   overflow: 'auto'
               }}
             ref={this.virtualListRef}
            >
                <div
                   style={{
                       height: innerContainerHeight,
                       position: 'relative'
                   }}
                > 
                  {data.map((item,index)=>{
                     return <div
                        // index用来复用
                        key={index}
                        style={{
                            position: 'absolute',
                            transform: `translateY(${item.$pos}px)`,
                        }}
                     >
                        { this.props.children(item.origin)}
                     </div>
                  })}
                </div>
            </div>
        )
    }
}
