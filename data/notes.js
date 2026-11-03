// Study notes, built around side-by-side contrasts. Learners attempt recall before opening one.
DP600.primers.push(
{ id:'n-store', title:'Lakehouse, warehouse or eventhouse', s:['get-store'], blocks:[
  ['table',['','Lakehouse','Warehouse','Eventhouse'],[
    ['Write with','Spark, dataflows, pipelines','T-SQL, dataflows, pipelines','Eventstream, KQL ingestion'],
    ['Read with','Spark, or T-SQL through the read-only endpoint','T-SQL, Spark (with ReadAll)','KQL, some T-SQL'],
    ['Data shape','Any: tables and files','Structured, some JSON','Events, logs, time series'],
    ['Multi-table transactions','No','Yes','No'],
    ['Pick when','Spark team, varied data, medallion layers','SQL team, serving gold, T-SQL writes','Latency of seconds, streaming data']]],
  ['p',`The SQL analytics endpoint on a lakehouse is read-only for table data. It can still hold views, functions and security policies, but INSERT, UPDATE and DELETE go through Spark.`],
] },
{ id:'n-move', title:'Getting data in', s:['get-move','get-shortcut'], blocks:[
  ['table',['Option','Signature words in a question','Copies data?'],[
    ['Shortcut','"without copying", "reference in place"','No'],
    ['Mirroring','"continuous", "read-only", "minimal setup", database source','Yes, replica'],
    ['Copy job','"scheduled", "incremental", "no pipeline"','Yes'],
    ['Copy activity','"with dependencies", "orchestrated", "custom source query"','Yes'],
    ['Dataflow Gen2','"Power Query", "M", "low code", "reshape"','Yes'],
    ['Eventstream','"real time", "events", "seconds"','Yes, streaming'],
    ['Notebook','"Spark", "PySpark", "complex logic"','As coded'],
    ['Load to tables','"no code", "from Lakehouse explorer", CSV or Parquet','Yes']]],
  ['list',[`Tables shortcuts: top level only, needs a supported table format such as Delta, and appears on the SQL endpoint.`,`Files shortcuts: any depth and any format, with no table discovery.`,`Deleting a shortcut is safe. Deleting a file through a shortcut can delete it at the target.`,`Internal OneLake shortcuts use the caller's identity, except through Direct Lake on SQL or delegated T-SQL, where the item owner's identity is used.`]],
] },
{ id:'n-access', title:'Who can do what', s:['sec-access'], blocks:[
  ['table',['Capability','Viewer','Contributor','Member','Admin'],[
    ['T-SQL read, SQL endpoint (ReadData)','Yes','Yes','Yes','Yes'],
    ['Spark, OneLake API, Lakehouse explorer (ReadAll)','No','Yes','Yes','Yes'],
    ['Write data, create items, run notebooks and pipelines','No','Yes','Yes','Yes'],
    ['Add members and lower roles','No','No','Yes','Yes'],
    ['Connect workspace to Git, add admins, delete workspace','No','No','No','Yes']]],
  ['table',['Item sharing option','Grants','Lets the person'],[
    ['No extras','Read','Connect only, until you GRANT objects'],
    ['Read all data using SQL','ReadData','Query every table in T-SQL'],
    ['Read all data using Apache Spark','ReadAll','Read files with Spark, and subscribe to OneLake events']]],
  ['p',`ReadData and ReadAll do not overlap. Sharing grants read access only; to write, a person needs a workspace role.`],
] },
{ id:'n-granular', title:'RLS, CLS, OLS, masking', s:['sec-granular'], blocks:[
  ['table',['Feature','Scope','Blocked user sees','Built with'],[
    ['Warehouse RLS','Rows','Fewer rows, no error','CREATE SECURITY POLICY plus a predicate function'],
    ['Warehouse CLS','Columns','Error if the column is requested','GRANT SELECT on allowed columns'],
    ['Dynamic data masking','Column values','Masked values','MASKED WITH (FUNCTION = ...)'],
    ['Model RLS','Rows','Fewer rows','Role with a DAX filter, USERPRINCIPALNAME()'],
    ['Model OLS','Tables, columns','Object does not exist, error on use','Role permissions, Tabular Editor'],
    ['OneLake security','Folders, tables, rows, columns','Only permitted data','Roles on the item; affects Viewer and Read users']]],
  ['code',`CREATE FUNCTION sec.fn_rep(@Rep AS nvarchar(128))\nRETURNS TABLE WITH SCHEMABINDING AS\nRETURN SELECT 1 AS ok WHERE @Rep = USER_NAME();\n\nCREATE SECURITY POLICY sec.SalesPolicy\nADD FILTER PREDICATE sec.fn_rep(Rep) ON dbo.Sales\nWITH (STATE = ON);`],
  ['list',[`Masking is not a security boundary: range predicates can reveal the values. Contributor and above see real data.`,`Test with a low-privilege identity. Test dynamic RLS by viewing as the specific user.`,`SQL RLS, CLS and masking interact with Direct Lake: see the Direct Lake note.`]],
] },
{ id:'n-alm', title:'Git, files and deployment pipelines', s:['alm-git','alm-deploy','alm-xmla'], blocks:[
  ['table',['File','Holds','Use for'],[
    ['.pbix','Report, model, data in one binary','Normal authoring'],
    ['.pbip','Text definitions in folders','Git, bulk editing, TMDL'],
    ['.pbit','Layout and queries, no data','Reusable templates'],
    ['.pbids','Connection details only','Standardizing data access']]],
  ['table',['Deployment pipelines','Answer'],[
    ['Git providers (separate feature)','Azure DevOps, GitHub, GitHub Enterprise, all cloud only'],
    ['Pipeline permission','Only one: Admin. It does not give access to workspace content'],
    ['To deploy between existing stages','Pipeline admin and at least Contributor on source and target'],
    ['Copied','Metadata, report pages, relationships between items'],
    ['Not copied','Data, refresh schedules, credentials, role assignments, permissions, URL, ID'],
    ['Direct Lake rebinding','SQL: data source rule. OneLake: M parameter and parameter rule'],
    ['Stages','Fixed after creation; deploy to any adjacent stage in either direction']]],
  ['list',[`XMLA writes need the tenant setting allowed and capacity XMLA set to Read Write. The capacity default is Read only.`,`After an XMLA write, a Desktop-authored model cannot be downloaded as .pbix, so keep your source.`,`Impact analysis lists downstream items and owners, starting from lineage.`]],
] },
{ id:'n-gov', title:'Capacity and governance', s:['plan-cap','gov'], blocks:[
  ['table',['Stage','What happens'],[['Smoothing','Usage spread over time, no penalty'],['Interactive delay','Interactive work slowed'],['Interactive rejection','Interactive work refused'],['Background rejection','All new work refused']]],
  ['list',[`Diagnose throttling with the Capacity Metrics app, not the Monitoring hub.`,`F SKUs are pay-as-you-go and can be paused. P SKUs are being retired.`,`On-premises gateway for a data center; VNet gateway for Azure private networks, with nothing to install.`,`Promoted: item owner. Certified and Master data: authorized people only.`,`Domains are created in the admin portal and browsed in the OneLake catalog.`,`Scope tenant settings to security groups for a proof of concept.`]],
] },
{ id:'n-spark', title:'PySpark core (your priority)', s:['tx-spark'], blocks:[
  ['p',`You marked PySpark as a gap. Type these patterns out in the lab rather than only reading them, because producing code from memory beats re-reading it.`],
  ['code',`from pyspark.sql import functions as F, Window\n\n# Read\ndf = spark.read.option("header", "true").csv("Files/raw/*.csv")\ndf = spark.read.table("sales")\ndf = spark.read.format("delta").load("Tables/sales")\n\n# Columns\ndf = df.withColumn("d", F.col("ts").cast("date"))\ndf = df.withColumnRenamed("old", "new")\ndf = df.select("a", "b")\ndf = df.drop("c")\n\n# Rows\ndf = df.filter((F.col("x") > 0) & (F.col("x") < 100))\ndf = df.dropna(subset=["id"]).fillna({"qty": 0})\ndf = df.dropDuplicates(["id"])\n\n# Logic and aggregates\ndf = df.withColumn("band", F.when(F.col("p") <= 50, "low").otherwise("high"))\nout = df.groupBy("country").agg(F.sum("amt").alias("total"))\n\n# Latest row per key\nw = Window.partitionBy("id").orderBy(F.col("updated").desc())\nlatest = df.withColumn("rn", F.row_number().over(w)).filter("rn = 1")\n\n# Joins\nj = big.join(F.broadcast(small), "id", "left")\n\n# Write\ndf.write.format("delta").mode("overwrite").saveAsTable("sales")\ndf.write.format("delta").mode("append").option("mergeSchema", "true").saveAsTable("sales")\ndf.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable("sales")\ndf.write.partitionBy("year", "month").format("delta").saveAsTable("sales")`],
  ['table',['Method','Does','Returns'],[
    ['show()','Prints rows','Nothing'],['display(df)','Interactive table and chart view (Fabric)','Nothing'],['explain()','Prints the plan','Nothing, so cannot chain'],['describe()','count, mean, stddev, min, max','DataFrame'],['summary()','Those plus percentiles','DataFrame']]],
  ['table',['Traps','Remember'],[
    ['and / or on columns','Use & and |, with parentheses around each condition'],
    ['cast vs alias','cast changes type; alias changes the name'],
    ['DataFrame coalesce vs F.coalesce','The first changes partition count; the second handles nulls'],
    ['pandas','Single node, in memory; not for billions of rows'],
    ['saveAsTable vs save','saveAsTable takes a name; save takes a path such as Tables/sales']]],
] },
{ id:'n-sql', title:'T-SQL patterns', s:['tx-sql'], blocks:[
  ['table',['Need','Function','Not'],[
    ['First non-null','COALESCE','IIF, CHOOSE'],['Largest or smallest within a row','GREATEST, LEAST','MAX, MIN (across rows)'],['Start of month','DATETRUNC(month, d)','DATEPART'],['Weekday name','DATENAME(weekday, d)','DATEPART (a number)'],['Latest row per key','ROW_NUMBER filter','RANK (ties)'],['Filter aggregated groups','HAVING','WHERE, or an alias'],['Zero-copy copy','CREATE TABLE ... AS CLONE OF','CTAS']]],
  ['code',`-- Latest row per customer\nWITH x AS (\n  SELECT *, ROW_NUMBER() OVER (PARTITION BY CustomerID ORDER BY LastUpdated DESC) AS rn\n  FROM stage.Customers)\nSELECT * FROM x WHERE rn = 1;\n\n-- Query across items in a workspace\nCREATE TABLE dbo.Pos AS SELECT * FROM Lakehouse1.dbo.Customer;\n\n-- Schema-scoped permission\nGRANT ALTER ON SCHEMA::SchemaA TO User1;  -- needed for TRUNCATE`],
  ['list',[`Live query problems: sys.dm_exec_requests. Past queries: queryinsights views.`,`A table clone is independent after creation, in both directions.`]],
] },
{ id:'n-kql', title:'KQL for SQL people (new for most candidates)', s:['q-kql'], blocks:[
  ['p',`The video does not cover KQL, but Microsoft's certification page lists it. You already know SQL, so learn it by translation.`],
  ['table',['SQL','KQL'],[
    ['SELECT TOP 5 * (any rows)','T | take 5'],['ORDER BY x DESC + TOP 5','T | top 5 by x'],['WHERE a > 1','T | where a > 1'],['SELECT a, b','T | project a, b'],['SELECT *, a*2 AS c','T | extend c = a*2'],['GROUP BY','T | summarize count() by a'],['DATEADD(hour, -1, now)','ago(1h)'],['Time bucket','bin(ts, 5m)'],['ORDER BY x','T | order by x (descending by default)']]],
  ['code',`Telemetry\n| where Timestamp > ago(1d) and Level == "Error"\n| summarize Errors = count() by Service, bin(Timestamp, 1h)\n| order by Errors desc`],
  ['list',[`KQL is case-sensitive.`,`Turn on OneLake availability to use KQL data as Delta in Spark or Direct Lake.`,`Query a OneLake shortcut in a KQL database with external_table('name').`]],
] },
{ id:'n-m', title:'Dataflows and Power Query', s:['tx-m','eda'], blocks:[
  ['table',['Profile view','Shows'],[['Column quality','Valid, error, empty percentages'],['Column distribution','Distinct, unique, frequency bars'],['Column profile','Stats including min, max, in a details pane']]],
  ['list',[`Profiling covers the top 1,000 rows unless you change it to the entire data set.`,`Distinct means different values. Unique means values occurring once.`,`Merge = join, Append = union. Fuzzy matching can ignore spaces and case.`,`Unpivot other columns copes with newly added columns.`,`Table.Profile: per-column statistics. Table.Max: the largest row.`,`Value.NativeQuery with EnableFolding=true lets later steps fold.`,`Files such as CSV have no engine, so there is no folding.`]],
  ['table',['Analytics type','Question'],[['Descriptive','What happened?'],['Diagnostic','Why did it happen?'],['Predictive','What will happen?'],['Prescriptive','What should we do?']]],
] },
{ id:'n-star', title:'Star schema and SCD', s:['tx-star'], blocks:[
  ['table',['','Type 1','Type 2'],[['On change','Update in place','Expire old row, insert new row'],['History','None','Full'],['New key','Insert','Insert'],['Added columns','Maybe a modified date','Surrogate key, start date, end date, current flag']]],
  ['list',[`Surrogate keys let one business key have several versions.`,`Denormalize snowflakes into a single dimension. Use a bridge table for many-to-many.`,`Power BI relationships use one column, so a composite business key usually needs a surrogate key.`]],
] },
{ id:'n-delta', title:'Delta table maintenance', s:['opt-delta'], blocks:[
  ['table',['Command','Does','Remember'],[
    ['OPTIMIZE','Compacts small files','Fixes the small-file problem'],['VACUUM','Deletes unreferenced files','7 day default; limits time travel'],['OPTIMIZE ... VORDER','Applies V-Order on compaction','Read-optimized Parquet layout'],['OPTIMIZE ... ZORDER BY','Clusters data for file skipping','Complements V-Order'],['DESCRIBE HISTORY','Lists past operations','Was maintenance run?'],['DESCRIBE DETAIL','Current size and file count','Not a history'],['REFRESH TABLE','Refreshes Spark metadata cache','Not maintenance']]],
  ['list',[`V-Order is disabled by default for Spark writes in new workspaces. Enable through session config, table property, or a read-heavy resource profile.`,`Warehouse V-Order is on by default; disabling is irreversible.`,`Load to tables output is Delta with V-Order.`,`Never delete Delta files by hand.`,`Partition only on low-cardinality filter columns.`]],
] },
{ id:'n-dl', title:'Direct Lake (most changed topic)', s:['sm-storage'], blocks:[
  ['p',`Most older exam prep treats Direct Lake as one thing. There are now two options, and the differences are testable.`],
  ['table',['','Direct Lake on OneLake','Direct Lake on SQL'],[
    ['Sources','One or more Fabric items','A single item'],['DirectQuery fallback','Never','Yes, by DirectLakeBehavior'],['SQL views','Not supported','Supported, through fallback'],['SQL RLS','Query succeeds; RLS NOT applied','Falls back, RLS applied'],['Combine with Import','Yes','No, in the same model'],['Over guardrails','Refresh fails, cannot query','Falls back with a warning'],['Deployment rebinding','M parameter rule','Data source rule'],['Microsoft recommends','For new models','Existing and SQL-dependent models']]],
  ['table',['DirectLakeBehavior','Effect'],[['Automatic (default)','Falls back silently'],['DirectLakeOnly','Errors instead of fallback'],['DirectQueryOnly','Always DirectQuery, for measuring']]],
  ['list',[`Fallback causes (SQL mode): SQL RLS, OLS or masking; unmaterialized views; guardrails; a table not yet framed.`,`Framing is a metadata-only refresh. Queries see the Delta table as of the last frame.`,`Automatic updates are on by default. Turn them off to hide partial ETL.`,`Transcoding loads columns on demand. Columns can be evicted when idle or under memory pressure.`,`Diagnose with EVALUATE TABLETRAITS().`,`Default semantic models are retired. Create models explicitly.`]],
] },
{ id:'n-dax', title:'DAX and modeling features', s:['sm-dax','sm-calc','sm-design'], blocks:[
  ['code',`Sales LY = CALCULATE([Sales], SAMEPERIODLASTYEAR('Date'[Date]))\n\n% Total = DIVIDE([Sales], CALCULATE([Sales], REMOVEFILTERS('Product')))\n\nMTD item = CALCULATE(SELECTEDMEASURE(), DATESMTD('Date'[Date]))\n\nPrev = CALCULATE([Sales], OFFSET(-1, ALLSELECTED('Date'[Month]), ORDERBY('Date'[Month])))\n\nHas Orders = NOT ISEMPTY(CALCULATETABLE(OrderLine))\n\nRed = CALCULATE([Sales], KEEPFILTERS('P'[Color] = "Red"))`],
  ['table',['Feature','Use when'],[['Calculation group','Reusing the same logic across many measures'],['Field parameter','Consumers swap measures or dimensions in a visual'],['Dynamic format string','Display varies by context, value stays numeric'],['User-defined aggregations','Speeding up DirectQuery with summaries you design'],['Automatic aggregations','Letting ML pick the summaries'],['Large model format','Big models, XMLA writes, scale-out prerequisite']]],
  ['list',[`Measures use no storage. Calculated columns are stored.`,`Split datetime columns to lower cardinality.`,`Boolean filters with KEEPFILTERS beat FILTER on single Import columns.`,`Discourage implicit measures is a model property, and calc groups require it.`]],
] },
{ id:'n-tools', title:'Tools and performance', s:['sm-perf','sm-refresh'], blocks:[
  ['table',['Tool','Job'],[['Performance Analyzer','Which visual is slow, and where its time goes'],['DAX Studio','Query, Server Timings, FE vs SE, VertiPaq stats'],['Tabular Editor','Edit metadata, calc groups, OLS, BPA, C# scripts'],['ALM Toolkit','Compare and deploy between models'],['Capacity Metrics app','Throttling and capacity usage'],['TMDL view','Scripted model edits inside Desktop']]],
  ['table',['Performance Analyzer shows','Interpret as'],[['High DAX query','Tune the measure or model'],['High Visual display','Simplify the visual'],['High Other','Waiting, often for too many visuals'],['Direct query shown on Direct Lake','Fallback occurred']]],
  ['list',[`Formula engine: single-threaded, row-by-row logic. Storage engine: fast data scans.`,`Incremental refresh: RangeStart and RangeEnd must be Date/Time, and the filter should fold.`,`Direct Lake has no model partitions: partition at Delta level.`,`Scale-out requires large semantic model format.`]],
] },
);

DP600.labs.push(
{ id:'L1', title:'Lakehouse from files', mins:30, s:['get-move','get-shortcut'], goal:`Build a lakehouse, load files with no code, and see which data the SQL endpoint exposes.`,
  steps:[`Create a dev workspace on your work capacity (or use one you are allowed to use).`,`Create a lakehouse. Upload two CSV files to a folder under Files.`,`Use Load to tables on the folder to create a Delta table.`,`Open the SQL analytics endpoint and query the table. Try an UPDATE and read the error.`,`Create an internal shortcut in Tables to a table in another lakehouse. Confirm you can query it.`,`Create a shortcut in Files and confirm it does not appear on the endpoint.`],
  check:`From memory, write down which three things the SQL endpoint can do and which it cannot.` },
{ id:'L2', title:'PySpark essentials from a blank cell', mins:60, s:['tx-spark'], goal:`Write the core transformations yourself. Close the notes first, and only check them when stuck.`,
  code:`from pyspark.sql import functions as F\n\n# Self-contained test data, so this needs no source system.\nrows = [(1, "2026-01-05 10:00:00", "ES", " 120.50", None),\n        (2, "2026-01-06 12:30:00", "FR", "-5.00", 3),\n        (2, "2026-01-07 08:00:00", "FR", "75.00", 4),\n        (3, "2026-02-01 09:15:00", None, "1500.00", 1)]\ndf = spark.createDataFrame(rows, ["id", "ts", "country", "amount", "qty"])\ndisplay(df)`,
  steps:[`Cast ts to timestamp, add a date column, and cast trimmed amount to decimal.`,`Remove rows with a non-positive amount, and fill missing qty with 0.`,`Add a band column with when/otherwise: low up to 50, medium up to 1000, high above.`,`Keep only the latest row per id using a window.`,`Aggregate total amount by country and band, with aliases.`,`Save the result as a Delta table, then append a DataFrame with one extra column using mergeSchema.`,`Run df.explain() and df.summary(). Open chart view with display.`],
  check:`Delete your cells and rewrite the window and the merge-schema write from memory.` },
{ id:'L3', title:'SCD Type 1 and Type 2 with merge', mins:50, s:['tx-star','tx-spark'], goal:`Implement both patterns on a small dimension and inspect the results.`,
  steps:[`Create dim_customer with a surrogate key, natural key, city, start date, end date and is_current.`,`Create a source DataFrame with one changed city and one new customer.`,`Type 1: use DeltaTable merge with whenMatchedUpdateAll and whenNotMatchedInsertAll on a copy of the table.`,`Type 2: expire changed rows using merge, then insert new versions with new surrogate keys.`,`Query the customer's history and confirm one row is current.`,`Run DESCRIBE HISTORY and identify each operation.`],
  check:`Explain which added columns the Type 2 table has and why a surrogate key is required.` },
{ id:'L4', title:'Delta maintenance', mins:30, s:['opt-delta'], goal:`See the small-file problem and fix it.`,
  steps:[`Append small batches in a loop (for example 50 appends) to a Delta table.`,`Run DESCRIBE DETAIL and note numFiles.`,`Check spark.conf.get('spark.sql.parquet.vorder.default') in this workspace.`,`Run OPTIMIZE, then DESCRIBE DETAIL again.`,`Run VACUUM, and read about the retention check. Do not lower retention on shared tables.`,`Review DESCRIBE HISTORY.`],
  check:`State what each command changes, and what breaks if someone deletes Parquet files by hand.` },
{ id:'L5', title:'Warehouse T-SQL objects', mins:45, s:['tx-sql'], goal:`Practice what you know in the Fabric surface, including features unique to it.`,
  steps:[`Create a warehouse and a schema. Create a table through CTAS from your lakehouse with a three-part name.`,`Clone the table with AS CLONE OF. Change the clone and confirm the source is unaffected.`,`Create a view with a CASE pricing band.`,`Write a date dimension stored procedure, then run it.`,`Use DATETRUNC, DATENAME, COALESCE, LEAST and GREATEST.`,`Check sys.dm_exec_requests and the queryinsights views.`],
  check:`Without notes, write the latest-row-per-key query and explain RANK's flaw here.` },
{ id:'L6', title:'Warehouse security', mins:40, s:['sec-granular','sec-access'], goal:`Implement RLS, CLS and masking and test them as a low-privilege user. Needs a colleague or test account; get approval if your tenant requires it.`,
  steps:[`Share the warehouse with a test user with no additional permissions, and confirm queries fail.`,`GRANT SELECT on one table, excluding a column, and try both queries.`,`Add an email mask. Compare results as Contributor and as the test user.`,`Create a security policy for RLS. Test as the user.`,`Remove the test access when you finish.`],
  check:`Say why a Contributor is a bad test identity for this lab.` },
{ id:'L7', title:'Pipeline orchestration', mins:40, s:['orch'], goal:`Chain activities and see how dependencies behave.`,
  steps:[`Create a pipeline with a Lookup that returns a max value from a table.`,`Pass it into a Notebook or Stored procedure activity through an expression.`,`Add an Invoke pipeline step, and a step on Upon failure.`,`Force a failure and see which paths run. Change to Upon completion and repeat.`,`Configure a Weekly schedule for two days, then turn it off to avoid consuming capacity.`],
  check:`State what each of the four dependency conditions does.` },
{ id:'L8', title:'Dataflow and profiling', mins:35, s:['tx-m','eda'], goal:`Use the profile tools and the Power Query features that appear on the exam.`,
  steps:[`Create a Dataflow Gen2 with a lakehouse destination.`,`Turn on column quality, distribution, and profile. Switch to the entire data set.`,`Use Merge with fuzzy matching and ignore spaces. Compare with an exact merge.`,`Use Unpivot other columns.`,`Add Table.Profile as a step and read the output.`],
  check:`Explain distinct vs unique, and which view shows min and max.` },
{ id:'L9', title:'Direct Lake both ways', mins:60, s:['sm-storage'], goal:`Trigger fallback deliberately, since this is the most heavily updated topic.`,
  steps:[`Create a Direct Lake on SQL model from a lakehouse table, plus a table based on a SQL view.`,`Run EVALUATE TABLETRAITS() in DAX query view and read the fallback column.`,`In Performance Analyzer, compare a visual on each table.`,`Set Direct Lake behavior to DirectLakeOnly and see the view-based visual fail.`,`Create a Direct Lake on OneLake model. Confirm that views cannot be used.`,`Change the Delta table. See data appear, then turn off automatic updates and repeat.`],
  check:`Write the comparison table from memory: fallback, views, RLS, sources, composite.` },
{ id:'L10', title:'DAX and tools', mins:60, s:['sm-dax','sm-calc','sm-perf'], goal:`Practice calc groups and diagnosis. Install DAX Studio and Tabular Editor 2 if your IT policy allows.`,
  steps:[`Build a calculation group with YTD, MTD and PY in Desktop, using SELECTEDMEASURE.`,`Add a field parameter and a dynamic format string.`,`Write an OFFSET measure and a measure using KEEPFILTERS.`,`Capture Performance Analyzer, then move a slow query into DAX Studio with Server Timings.`,`Run VertiPaq Analyzer and Tabular Editor's Best Practice Analyzer.`,`Set up dynamic RLS and OLS, then test as a role.`],
  check:`Explain the order of steps for finding a slow query, and how to read FE vs SE.` },
{ id:'L11', title:'Git and deployment pipelines', mins:60, s:['alm-git','alm-deploy'], goal:`Run the full lifecycle in dev workspaces only.`,
  steps:[`Save a report as .pbip and look at the folder structure.`,`Connect a dev workspace to a Git branch (a personal repo works if your tenant allows it). Commit and update.`,`Create a three-stage deployment pipeline with empty test and prod workspaces.`,`Deploy from Dev, then look at what did not copy: data, schedule, roles.`,`Add a deployment rule for a Direct Lake model's source.`,`Use lineage and impact analysis on a table.`],
  check:`List the permissions a developer needs to deploy to Test but not Prod.` },
{ id:'L12', title:'Eventhouse and KQL', mins:45, s:['q-kql','get-store'], goal:`Get comfortable with KQL using a Fabric sample.`,
  steps:[`Create an eventhouse and load a sample data set, or use the Real-Time Intelligence tutorial data.`,`Write where, summarize, bin, project, extend, take and top queries.`,`Convert three of your T-SQL queries to KQL.`,`Turn on OneLake availability and read the table through a lakehouse shortcut.`],
  check:`Write an hourly error count by service from memory.` },
);
