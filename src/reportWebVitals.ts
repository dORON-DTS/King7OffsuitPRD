import { ReportHandler } from 'web-vitals';

const reportWebVitals = (onPerfEntry?: ReportHandler) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then((webVitals) => {
      const api = webVitals.default || webVitals;
      api.getCLS(onPerfEntry);
      api.getFID(onPerfEntry);
      api.getFCP(onPerfEntry);
      api.getLCP(onPerfEntry);
      api.getTTFB(onPerfEntry);
    });
  }
};

export default reportWebVitals;
