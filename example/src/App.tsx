import React from 'react';
import './App.css';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { connector } from './app/store';
import { add } from './features/todo/todoSlice';

function App() {
  const state = useAppSelector(state => state);
  const dispatch = useAppDispatch();

  React.useEffect(() => {
    connector.setConnection(undefined, undefined, dispatch);
    return () => { };
  }, [dispatch]);

  return (
    <div className="App">
      App state:
      <br />
      <ObjectDisplay obj={state} />
      <button onClick={() => state.connection !== "disconnected" && dispatch(add({
        participant: state.connection.clientId,
        text: "whatever"
      }))}>Click me!</button>
    </div>
  );
}

function ObjectDisplay(props: { obj: any }) {
  const { obj } = props;
  if (typeof obj === "object") {
    return <div className="object" >{Object.entries(obj).map(([k, v]) => <div key={k}>
      <div className="key">{k}</div>
      <ObjectDisplay obj={v} />
    </div>)}</div>
  }
  return <div className="literal">{`${obj}`}</div>
}

export default App;
