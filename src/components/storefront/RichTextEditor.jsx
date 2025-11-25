import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Bold, Italic, List, Link as LinkIcon, Heading } from 'lucide-react';

const RichTextEditor = ({ value, onChange, placeholder, minHeight = '300px' }) => {
  const [activeTab, setActiveTab] = useState('edit');

  const insertMarkdown = (before, after = '') => {
    const textarea = document.getElementById('markdown-editor');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);
    onChange(newText);
    
    // إعادة تركيز المؤشر
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  };

  const renderMarkdown = (text) => {
    if (!text) return <p className="text-muted-foreground">لا يوجد محتوى للمعاينة</p>;
    
    return text.split('\n').map((line, i) => {
      // Headings
      if (line.startsWith('### ')) {
        return <h3 key={i} className="text-xl font-bold mt-4 mb-2">{line.substring(4)}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={i} className="text-2xl font-bold mt-6 mb-3">{line.substring(3)}</h2>;
      }
      if (line.startsWith('# ')) {
        return <h1 key={i} className="text-3xl font-bold mt-8 mb-4">{line.substring(2)}</h1>;
      }
      
      // Lists
      if (line.trim().startsWith('• ') || line.trim().startsWith('- ')) {
        return <li key={i} className="mr-6">{line.trim().substring(2)}</li>;
      }
      if (line.trim().startsWith('✓ ')) {
        return <li key={i} className="mr-6 text-green-600">✓ {line.trim().substring(2)}</li>;
      }
      if (line.trim().startsWith('✗ ')) {
        return <li key={i} className="mr-6 text-red-600">✗ {line.trim().substring(2)}</li>;
      }
      
      // Bold and Italic
      let processedLine = line;
      processedLine = processedLine.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      processedLine = processedLine.replace(/\*(.+?)\*/g, '<em>$1</em>');
      
      // Empty lines
      if (!line.trim()) {
        return <div key={i} className="h-4" />;
      }
      
      return <p key={i} className="mb-2" dangerouslySetInnerHTML={{ __html: processedLine }} />;
    });
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="border-b bg-muted/30 p-2 flex items-center justify-between">
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown('**', '**')}
              title="نص عريض"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown('*', '*')}
              title="نص مائل"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown('\n• ', '')}
              title="قائمة"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown('\n## ', '')}
              title="عنوان"
            >
              <Heading className="h-4 w-4" />
            </Button>
          </div>
          
          <TabsList>
            <TabsTrigger value="edit">تحرير</TabsTrigger>
            <TabsTrigger value="preview">معاينة</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="edit" className="m-0 p-0">
          <Textarea
            id="markdown-editor"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="border-0 rounded-none resize-none focus-visible:ring-0"
            style={{ minHeight }}
          />
        </TabsContent>
        
        <TabsContent value="preview" className="m-0 p-0">
          <div className="p-4 prose prose-sm max-w-none" style={{ minHeight }}>
            {renderMarkdown(value)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RichTextEditor;
