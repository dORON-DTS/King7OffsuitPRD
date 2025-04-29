import { ReportHandler } from 'web-vitals';

const reportWebVitals = (onPerfEntry?: ReportHandler) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
<<<<<<< HEAD
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(onPerfEntry);
      getFID(onPerfEntry);
      getFCP(onPerfEntry);
      getLCP(onPerfEntry);
      getTTFB(onPerfEntry);
=======
    import('web-vitals').then((webVitals) => {
      const api = webVitals.default || webVitals;
      api.getCLS(onPerfEntry);
      api.getFID(onPerfEntry);
      api.getFCP(onPerfEntry);
      api.getLCP(onPerfEntry);
      api.getTTFB(onPerfEntry);
>>>>>>> 9f3b28b883993b214415a4d9f59581c45756c51d
    });
  }
};

export default reportWebVitals;
