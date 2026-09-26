import { useState, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FileUp, Dice5, RefreshCw, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, CheckCircle, FileText } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './App.css';

// Set up the worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

function App() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfName, setPdfName] = useState<string>('');
  const [numPages, setNumPages] = useState<number>(0);
  const [viewedPages, setViewedPages] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState<number | null>(null);
  const [scale, setScale] = useState(1.0);
  const [isDragActive, setIsDragActive] = useState(false);
  const [allowRepeats, setAllowRepeats] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const targetScrollRef = useRef<{ left: number; top: number } | null>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Пожалуйста, выберите файл в формате PDF.');
      return;
    }
    setPdfFile(file);
    setPdfName(file.name);
    setNumPages(0);
    setViewedPages([]);
    setCurrentPage(null);
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const showRandomPage = () => {
    if (numPages === 0) return;
    
    const availablePages = [];
    if (allowRepeats) {
      for (let i = 1; i <= numPages; i++) {
        availablePages.push(i);
      }
    } else {
      for (let i = 1; i <= numPages; i++) {
        if (!viewedPages.includes(i)) {
          availablePages.push(i);
        }
      }
    }
    
    if (availablePages.length === 0) {
      return;
    }

    const randomIndex = Math.floor(Math.random() * availablePages.length);
    const selectedPage = availablePages[randomIndex];
    
    setCurrentPage(selectedPage);
    setViewedPages(prev => {
      if (!prev.includes(selectedPage)) {
        return [...prev, selectedPage];
      }
      return prev;
    });
  };

  const startNewCycle = () => {
    setViewedPages([]);
    setCurrentPage(null);
  };

  const closePdf = () => {
    setPdfFile(null);
    setPdfName('');
    setNumPages(0);
    setViewedPages([]);
    setCurrentPage(null);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page);
      setViewedPages(prev => {
        if (!prev.includes(page)) {
          return [...prev, page];
        }
        return prev;
      });
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handlePdfClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = pdfContainerRef.current;
    if (!container) return;
    
    // Не зумить, если кликнули по ссылке
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'a') return;

    // Shift + клик для уменьшения, обычный клик для увеличения
    const zoomStep = e.shiftKey ? -0.4 : 0.4;
    const newScale = Math.max(0.5, Math.min(scale + zoomStep, 4));
    
    if (newScale === scale) return;

    const rect = container.getBoundingClientRect();
    
    // Координаты клика относительно контента внутри контейнера
    const x = e.clientX - rect.left + container.scrollLeft;
    const y = e.clientY - rect.top + container.scrollTop;

    // Вычисляем новые координаты этого же места после зума
    const ratio = newScale / scale;
    const newX = x * ratio;
    const newY = y * ratio;

    // Целевой скролл, чтобы кликнутая точка осталась под курсором
    const targetLeft = newX - (e.clientX - rect.left);
    const targetTop = newY - (e.clientY - rect.top);

    targetScrollRef.current = { left: targetLeft, top: targetTop };
    setScale(newScale);
  };

  const onPageRenderSuccess = () => {
    if (targetScrollRef.current && pdfContainerRef.current) {
      pdfContainerRef.current.scrollLeft = targetScrollRef.current.left;
      pdfContainerRef.current.scrollTop = targetScrollRef.current.top;
      targetScrollRef.current = null;
    }
  };

  const renderUploadState = () => (
    <div 
      className={`upload-area ${isDragActive ? 'drag-active' : ''}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <FileUp className="upload-icon" />
      <h3>Перетащите PDF сюда или выберите файл</h3>
      <p>Поддерживается только формат .pdf</p>
      <button className="btn-primary" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
        Открыть PDF
      </button>
      <input 
        type="file" 
        accept=".pdf" 
        ref={fileInputRef} 
        onChange={onFileChange} 
        style={{ display: 'none' }} 
      />
    </div>
  );

  const renderDashboard = () => {
    const isCompleted = viewedPages.length === numPages && numPages > 0;
    const progress = numPages > 0 ? (viewedPages.length / numPages) * 100 : 0;

    if (isCompleted && !currentPage && !allowRepeats) {
      return (
        <div className="completion-state glass-panel">
          <CheckCircle className="success-icon" />
          <h2>🎉 Готово!</h2>
          <p>Вы просмотрели все {numPages} страниц.</p>
          <button className="btn-primary" onClick={startNewCycle}>
            <RefreshCw size={20} />
            Начать новый цикл
          </button>
        </div>
      );
    }

    return (
      <div className="dashboard">
        <div className="top-bar glass-panel">
          <div 
            className="brand" 
            onClick={closePdf} 
            style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
            title="Вернуться на главную (загрузить другой PDF)"
            onMouseOver={(e) => e.currentTarget.style.opacity = '0.7'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
          >
            <FileText className="brand-icon" />
            <h2>Random PDF</h2>
          </div>

          <div className="stats-area">
            <div className="stats-info">
              <span className="stats-filename" title={pdfName}>{pdfName}</span>
              <span className="stats-numbers">
                {allowRepeats ? (
                  <span style={{color: 'var(--accent-color)'}}>Бесконечный режим</span>
                ) : (
                  <span>Просмотрено: <strong>{viewedPages.length}</strong> / <strong>{numPages}</strong></span>
                )}
              </span>
            </div>
            
            <div className="progress-bar-container" style={{ background: allowRepeats ? 'transparent' : '', boxShadow: allowRepeats ? 'none' : '' }}>
              {allowRepeats ? (
                <div style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg, transparent, var(--accent-glow), transparent)', borderRadius: '4px', animation: 'shimmer 2s infinite' }}></div>
              ) : (
                <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
              )}
            </div>
          </div>

          <div className="top-controls">
            <label className="beautiful-toggle">
              <span className="toggle-label">Повторы</span>
              <input 
                type="checkbox" 
                checked={allowRepeats} 
                onChange={(e) => setAllowRepeats(e.target.checked)} 
              />
              <div className="toggle-switch"></div>
            </label>

            {(!isCompleted || allowRepeats) ? (
              <button className="btn-primary" onClick={showRandomPage} style={{ padding: '0.6rem 1.25rem' }}>
                <Dice5 size={20} />
                Случайная
              </button>
            ) : (
              <button className="btn-primary" onClick={startNewCycle} style={{ padding: '0.6rem 1.25rem' }}>
                <RefreshCw size={20} />
                Сначала
              </button>
            )}
          </div>
        </div>

        <div className="viewer-section">
          <div 
            className="pdf-container" 
            ref={pdfContainerRef}
            style={{ display: currentPage || !numPages ? 'flex' : 'none' }}
          >
            <Document 
              file={pdfFile} 
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<p style={{marginTop: '2rem'}}>Загрузка PDF...</p>}
            >
              {currentPage && (
                <div 
                  onClick={handlePdfClick} 
                  style={{ cursor: 'zoom-in', display: 'inline-block' }}
                  title="Кликните для увеличения (Shift+Клик для уменьшения)"
                >
                  <Page 
                    pageNumber={currentPage} 
                    scale={scale} 
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    onRenderSuccess={onPageRenderSuccess}
                    className="pdf-page"
                  />
                </div>
              )}
            </Document>
          </div>

          {currentPage && (
            <div className="controls">
              <button 
                className="btn-icon" 
                onClick={() => goToPage(currentPage - 1)} 
                disabled={currentPage <= 1}
                title="Предыдущая"
              >
                <ChevronLeft size={20} />
              </button>
              
              <button 
                className="btn-icon" 
                onClick={() => setScale(s => Math.max(s - 0.2, 0.5))}
                title="Уменьшить"
              >
                <ZoomOut size={20} />
              </button>

              <div className="page-indicator">
                Стр. {currentPage} / {numPages}
              </div>

              <button 
                className="btn-icon" 
                onClick={() => setScale(s => Math.min(s + 0.2, 3))}
                title="Увеличить"
              >
                <ZoomIn size={20} />
              </button>
              
              <button 
                className="btn-icon" 
                onClick={() => goToPage(currentPage + 1)} 
                disabled={currentPage >= numPages}
                title="Следующая"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      {!pdfFile && (
        <header className="header">
          <h1>
            <FileText className="brand-icon" style={{ width: '36px', height: '36px' }} />
            <span>Random PDF</span>
          </h1>
          <p>Загрузите PDF и проходите его страницы в случайном порядке</p>
        </header>
      )}
      
      {pdfFile ? renderDashboard() : renderUploadState()}
    </div>
  );
}

export default App;
