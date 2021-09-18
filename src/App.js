
import logo from './logo.svg';
import { of } from 'rxjs';
import VirtualList from './VirtualList.jsx';
import VirtualList1 from './VirtualList1.jsx';
import './App.css';

const initData = new Array(10000).fill(0).map((item,i) => i)
function App() {
  return (
      <div className='app'>
         {/* <VirtualList data$={of(initData)} options$={of({ height: 30 })}> 
            { data=> <div style={{ height: 30}}>
                 { data }
              </div>}
         </VirtualList> */}
         <VirtualList1 data$={of(initData)} options$={of({ height: 30 })}>
          { data=> <div style={{ height: 30}}>
                 { data }
              </div>}
         </VirtualList1>
     </div>
  );
}

export default App;
