import React, { useState, useCallback } from 'react';
import { Upload, Download, Sparkles, Instagram, Star } from 'lucide-react';
import config from './data/config.json';
import { createVerticalImage } from './lib/createVerticalImage';

interface UploadState {
  file: File | null;
  preview: string | null;
  processing: boolean;
  result: string | null;
  error: string | null;
  padding: number;
}

function App() {
  const [uploadState, setUploadState] = useState<UploadState>({
    file: null,
    preview: null,
    processing: false,
    result: null,
    error: null,
    padding: 50
  });

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadState(prev => ({ ...prev, error: 'Please select a valid image file' }));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadState(prev => ({ ...prev, error: 'File size must be less than 10MB' }));
      return;
    }

    const preview = URL.createObjectURL(file);
    setUploadState({
      file,
      preview,
      processing: false,
      result: null,
      error: null,
      padding: 50
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const processImage = async () => {
    if (!uploadState.file) return;

    setUploadState(prev => ({ ...prev, processing: true, error: null }));

    try {
      const blob = await createVerticalImage(uploadState.file, uploadState.padding);
      const resultUrl = URL.createObjectURL(blob);

      if (uploadState.result) URL.revokeObjectURL(uploadState.result);

      setUploadState(prev => ({
        ...prev,
        processing: false,
        result: resultUrl
      }));
    } catch (error) {
      setUploadState(prev => ({
        ...prev,
        processing: false,
        error: error instanceof Error ? error.message : 'Failed to process image'
      }));
    }
  };

  const downloadImage = () => {
    if (!uploadState.result) return;

    const link = document.createElement('a');
    link.href = uploadState.result;
    link.download = 'instagram-reel-cropped.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetUpload = () => {
    if (uploadState.preview) URL.revokeObjectURL(uploadState.preview);
    if (uploadState.result) URL.revokeObjectURL(uploadState.result);
    setUploadState({
      file: null,
      preview: null,
      processing: false,
      result: null,
      error: null,
      padding: 50
    });
  };

  const handlePaddingChange = (newPadding: number) => {
    setUploadState(prev => ({ ...prev, padding: newPadding }));
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <div className="relative">
                <Instagram className="w-20 h-20 text-gray-300" />
                <Sparkles className="w-8 h-8 text-gray-400 absolute -top-2 -right-2 animate-pulse" />
              </div>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
              {config.title}
            </h1>
            <p className="text-xl md:text-2xl text-gray-200 mb-8 max-w-3xl mx-auto leading-relaxed">
              {config.subtitle}
            </p>
            <p className="text-lg text-gray-300 mb-12 max-w-4xl mx-auto">
              {config.description}
            </p>
          </div>
        </div>
      </div>

      {/* Main App Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="bg-gray-800/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-gray-600/20 overflow-hidden">
          
          {!uploadState.file && (
            <div className="p-12">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-4">{config.upload.title}</h2>
                <p className="text-gray-300 text-lg">{config.upload.subtitle}</p>
              </div>

              <div
                className="border-3 border-dashed border-gray-500 rounded-2xl p-16 text-center hover:border-gray-400 transition-colors cursor-pointer bg-gray-700/50"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <Upload className="w-16 h-16 text-gray-300 mx-auto mb-6" />
                <p className="text-xl text-white mb-4 font-medium">
                  Drop your image here or click to browse
                </p>
                <p className="text-gray-400 mb-2">{config.upload.supportedFormats}</p>
                <p className="text-gray-400 text-sm">{config.upload.maxSize}</p>
                <input
                  id="file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {uploadState.file && !uploadState.result && (
            <div className="p-12">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-4">
                  {uploadState.processing ? config.processing.title : 'Ready to Process'}
                </h2>
                <p className="text-gray-300 text-lg">
                  {uploadState.processing ? config.processing.subtitle : 'Click the button below to transform your image'}
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <h3 className="text-lg font-semibold text-gray-200 mb-4">Original Image</h3>
                  <div className="rounded-2xl overflow-hidden shadow-lg">
                    <img
                      src={uploadState.preview!}
                      alt="Original"
                      className="w-full h-64 object-cover"
                    />
                  </div>
                </div>

                <div className="text-center">
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-200 mb-4">Horizontal Padding</h3>
                    <div className="px-4">
                      <input
                        type="range"
                        min="0"
                        max="200"
                        value={uploadState.padding}
                        onChange={(e) => handlePaddingChange(Number(e.target.value))}
                        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                      />
                      <div className="flex justify-between text-sm text-gray-400 mt-2">
                        <span>0px</span>
                        <span className="text-white font-medium">{uploadState.padding}px</span>
                        <span>200px</span>
                      </div>
                    </div>
                  </div>

                  {uploadState.processing ? (
                    <div className="space-y-6">
                      <div className="w-16 h-16 border-4 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                      <p className="text-gray-300">Processing your image...</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <button
                        onClick={processImage}
                        className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-12 py-4 rounded-2xl font-semibold text-lg hover:from-gray-700 hover:to-gray-800 transform hover:scale-105 transition-all shadow-lg"
                      >
                        <Sparkles className="w-6 h-6 inline mr-2" />
                        {config.cta.primary}
                      </button>
                      <div>
                        <button
                          onClick={resetUpload}
                          className="text-gray-400 hover:text-gray-200 underline"
                        >
                          Choose different image
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {uploadState.result && (
            <div className="p-12">
              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <Star className="w-12 h-12 text-gray-300" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">{config.result.title}</h2>
                <p className="text-gray-300 text-lg">{config.result.subtitle}</p>
              </div>

              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-200 mb-4 text-center">Adjust Horizontal Padding</h3>
                <div className="max-w-md mx-auto px-4">
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={uploadState.padding}
                    onChange={(e) => handlePaddingChange(Number(e.target.value))}
                    className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-sm text-gray-400 mt-2">
                    <span>0px</span>
                    <span className="text-white font-medium">{uploadState.padding}px</span>
                    <span>200px</span>
                  </div>
                </div>
                <div className="text-center mt-4">
                  <button
                    onClick={processImage}
                    disabled={uploadState.processing}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transform hover:scale-105 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadState.processing ? 'Processing...' : 'Regenerate'}
                  </button>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-8 items-start">
                <div>
                  <h3 className="text-lg font-semibold text-gray-200 mb-4">Original</h3>
                  <div className="rounded-2xl overflow-hidden shadow-lg">
                    <img
                      src={uploadState.preview!}
                      alt="Original"
                      className="w-full h-64 object-cover"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-200 mb-4">Reel-Ready</h3>
                  <div className="rounded-2xl overflow-hidden shadow-lg bg-gray-700">
                    <img
                      src={uploadState.result}
                      alt="Processed"
                      className="w-full max-h-96 object-contain"
                    />
                  </div>
                </div>
              </div>

              <div className="text-center mt-8 space-y-4">
                <button
                  onClick={downloadImage}
                  className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-12 py-4 rounded-2xl font-semibold text-lg hover:from-gray-700 hover:to-gray-800 transform hover:scale-105 transition-all shadow-lg"
                >
                  <Download className="w-6 h-6 inline mr-2" />
                  {config.result.downloadText}
                </button>
                <div>
                  <button
                    onClick={resetUpload}
                    className="text-gray-400 hover:text-gray-200 underline"
                  >
                    Process another image
                  </button>
                </div>
              </div>
            </div>
          )}

          {uploadState.error && (
            <div className="p-6 bg-red-900/50 border-l-4 border-red-500">
              <p className="text-red-200">{uploadState.error}</p>
              <button
                onClick={() => setUploadState(prev => ({ ...prev, error: null }))}
                className="text-red-300 hover:text-red-100 underline mt-2"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;