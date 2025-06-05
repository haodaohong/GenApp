'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// 定义消息类型
interface Message {
  message: string;
}

export default function Home() {
  const [messages, setMessages] = useState<string[]>([]);
  const [clientId] = useState<string>("client-123");

  // 订阅特定客户端的频道
  useEffect(() => {
    const channel = supabase
      .channel(`private:${clientId}`)
      .on('broadcast', { event: 'message' }, (payload: { payload: Message }) => {
        setMessages((prev) => [...prev, payload.payload.message]);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clientId]);

  // 发送测试消息
  const sendTestMessage = async () => {
    const message = prompt('输入要发送的消息:');
    if (message) {
      try {
        const response = await fetch('/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, message }),
        });
        if (!response.ok) {
          throw new Error('发送失败');
        }
      } catch (error) {
        console.error('发送失败:', error);
      }
    }
  };

  return (
    <div style={{ padding: '20px' }} className="flex flex-col items-center justify-center h-screen bg-gray-100">
      {/* <h1>客户端 ID: {clientId}</h1> */}
      <button onClick={sendTestMessage}>发送测试消息</button>
      <h2>收到的消息:</h2>
      <ul>
        {messages.map((msg, index) => (
          <li key={index}>{msg}</li>
        ))}
      </ul>
    </div>
  );
}