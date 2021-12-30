import { useAppDispatch, useAppSelector } from "../../app/hooks"
import { Message, writeMessage } from "./chatSlice";
import "./Chat.css"
import React from "react";

export function Chat() {
    const messages = useAppSelector(state => state.chat?.messages);

    const [renderTime, setRenderTime] = React.useState(() => Date.now());
    React.useEffect(() => {
        const handle = setInterval(() => setRenderTime(Date.now), 5000);
        return () => clearInterval(handle);
    }, []);

    return <div className="chat">
        <div className="messages">{messages?.map((x, i) => <ChatMessage message={x} key={i} now={renderTime} />)}</div>
        <ChatInput />
    </div>
}

function ChatMessage(props: { message: Message, now: number }) {
    const timeDifference = (props.now - props.message.timestamp) / 1000;
    let renderedTime;
    if (timeDifference < 5) {
        renderedTime = "just now";
    }
    else if (timeDifference < 60) {
        renderedTime = `${Math.round(timeDifference)} s ago`;
    }
    else {
        renderedTime = `${Math.round(timeDifference / 60)} min ago`;
    }

    return <div className="message">
        <div className="author">{props.message.author}</div>
        <div className="messageText">{props.message.message}</div>
        <div className="timestamp">{renderedTime}</div>
    </div>
}

function ChatInput() {
    const dispatch = useAppDispatch();
    const author = useAppSelector(state =>
        state.connection.type === "active"
            ? state.connection.clientId : null);
    return <div className="chatInput">
        <input type="text" placeholder="Type message here" onKeyPress={e => {
            if (e.key !== "Enter")
                return;
            dispatch(writeMessage({
                author: author!,
                message: e.currentTarget.value,
                timestamp: Date.now()
            }))
            e.currentTarget.value = "";
        }} />
    </div>
}