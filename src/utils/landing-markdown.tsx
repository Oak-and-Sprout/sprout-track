import React from 'react';

// Helper function to format text content with bold and italic
const formatTextContent = (text: string): React.ReactNode => {

  if (!text) return text;

  // Split text by markdown patterns and process each part
  let currentText = text;

  // Process the text character by character to handle nested formatting
  const tokens: Array<{ type: 'text' | 'bold' | 'italic', content: string }> = [];
  let i = 0;

  while (i < currentText.length) {
    // Check for bold (**text**)
    if (currentText.substring(i, i + 2) === '**') {
      const boldEnd = currentText.indexOf('**', i + 2);
      if (boldEnd !== -1) {
        const boldContent = currentText.substring(i + 2, boldEnd);
        tokens.push({ type: 'bold', content: boldContent });
        i = boldEnd + 2;
        continue;
      }
    }

    // Check for italic (*text*)
    if (currentText[i] === '*' && currentText.substring(i, i + 2) !== '**') {
      const italicEnd = currentText.indexOf('*', i + 1);
      if (italicEnd !== -1) {
        const italicContent = currentText.substring(i + 1, italicEnd);
        tokens.push({ type: 'italic', content: italicContent });
        i = italicEnd + 1;
        continue;
      }
    }

    // Regular text
    let textEnd = i + 1;
    while (textEnd < currentText.length &&
           currentText[textEnd] !== '*' &&
           !(currentText.substring(textEnd, textEnd + 2) === '**')) {
      textEnd++;
    }

    const textContent = currentText.substring(i, textEnd);
    if (textContent) {
      tokens.push({ type: 'text', content: textContent });
    }
    i = textEnd;
  }

  // Convert tokens to React nodes
  return tokens.map((token, index) => {
    switch (token.type) {
      case 'bold':
        return <strong key={index} className="font-semibold">{token.content}</strong>;
      case 'italic':
        return <em key={index} className="italic">{token.content}</em>;
      default:
        return token.content;
    }
  });
};

/** Renders the limited markdown dialect used by public/*.md legal files. */
export function renderMarkdown(content: string): React.ReactNode {
  // Process the content to group list items
  const lines = content.split('\n');
  const processedContent: React.ReactNode[] = [];
  let listItems: string[] = [];
  let currentListLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = i < lines.length - 1 ? lines[i + 1] : '';

    // Check if this is a list item
    if (line.startsWith('- ')) {
      // Add to current list
      listItems.push(line.replace('- ', ''));
      currentListLevel = 1;
      continue;
    }

    // If we were building a list and now we're not, render the list
    if (listItems.length > 0 && !line.startsWith('- ')) {
      processedContent.push(
        <ul key={`list-${i}`} className="list-disc pl-6 mb-4" style={{ listStyleType: 'disc' }}>
          {listItems.map((item, itemIndex) => (
            <li key={itemIndex} className="mb-1 flex items-start">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-500 mt-2 mr-2 flex-shrink-0"></span>
              <span>{formatTextContent(item)}</span>
            </li>
          ))}
        </ul>
      );
      listItems = [];
      currentListLevel = 0;
    }

    // Headers
    if (line.startsWith('# ')) {
      processedContent.push(
        <h1 key={i} className="text-2xl font-bold mt-6 mb-4">
          {formatTextContent(line.replace('# ', ''))}
        </h1>
      );
      continue;
    }

    if (line.startsWith('## ')) {
      processedContent.push(
        <h2 key={i} className="text-xl font-bold mt-6 mb-2">
          {formatTextContent(line.replace('## ', ''))}
        </h2>
      );
      continue;
    }

    if (line.startsWith('### ')) {
      processedContent.push(
        <h3 key={i} className="text-lg font-bold mt-4 mb-2">
          {formatTextContent(line.replace('### ', ''))}
        </h3>
      );
      continue;
    }

    if (line.startsWith('#### ')) {
      processedContent.push(
        <h4 key={i} className="text-base font-bold mt-3 mb-1 text-teal-700">
          {formatTextContent(line.replace('#### ', ''))}
        </h4>
      );
      continue;
    }

    // Horizontal rules (---)
    if (line.trim() === '---') {
      processedContent.push(
        <hr key={i} className="my-8 border-t border-gray-300" />
      );
      continue;
    }

    // Empty lines
    if (line.trim() === '') {
      processedContent.push(<br key={i} />);
      continue;
    }

    // Regular paragraphs with text formatting
    const formattedLine = formatTextContent(line);
    processedContent.push(<p key={i} className="mb-2">{formattedLine}</p>);
  }

  // If we have any remaining list items, render them
  if (listItems.length > 0) {
    processedContent.push(
      <ul key="list-final" className="list-disc pl-6 mb-4" style={{ listStyleType: 'disc' }}>
        {listItems.map((item, itemIndex) => (
          <li key={itemIndex} className="mb-1 flex items-start">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-500 mt-2 mr-2 flex-shrink-0"></span>
            <span>{formatTextContent(item)}</span>
          </li>
        ))}
      </ul>
    );
  }

  return <div>{processedContent}</div>;
}
