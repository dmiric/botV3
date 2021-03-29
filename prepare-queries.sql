-- SQLite
INSERT INTO trade_system_rules (id, `rules`)
VALUES (1, '{"1":1,"2":1.147962,"3":1.317818,"4":1.512805,"5":1.736644,"6":1.993602,"7":2.288580,"8":2.627205,"9":3.015932,"10":3.462177,"11":3.974449,"12":4.562519,"13":5.237601,"14":6.012569,"15":6.902204,"16":7.923471,"17":9.095847,"18":10.441692,"19":11.986670,"20":13.760253}');

-- SQLite
INSERT INTO trade_system_buy_orders (id, 'values') VALUES (1, '{"1":1,"2":1.147962,"3":1.317818,"4":1.512805,"5":1.736644,"6":1.993602,"7":2.288580,"8":2.627205,"9":3.015932,"10":3.462177,"11":3.974449,"12":4.562519,"13":5.237601,"14":6.012569,"15":6.902204,"16":7.923471,"17":9.095847,"18":10.441692,"19":11.986670,"20":13.760253}');
INSERT INTO trade_system_buy_orders (id, 'values') VALUES (2, '{"1":1, "2":2,"3":3,"4":4,"5":5, "6":6,"7":7, "8":8,"9":9, "10":10, "11":11, "12":12, "13":13, "14":14, "15":15, "16":16, "17":17, "18":18, "19":19, "20":20 }');

/*
SELECT bo.sa, so.sa, bo.ca, so.ca, bo.sa/bo.ca FROM
(SELECT SUM(amount*startPrice) as sa, count(amount) as ca from buy_order where gid = 97) as bo,
(SELECT SUM(amount*price) as sa, count(amount) as ca from sell_order where gid = 97) as so
*/